import {
    type ApiVersion,
    ERC7769Errors,
    type JSONRPCResponse,
    RpcError,
    altoVersions,
    bundlerRequestSchema,
    jsonRpcSchema
} from "@alto/types";
import type { Metrics } from "@alto/utils";
import websocket from "@fastify/websocket";
import * as sentry from "@sentry/node";
import Fastify, {
    type FastifyBaseLogger,
    type FastifyInstance,
    type FastifyReply,
    type FastifyRequest
} from "fastify";
import type { Registry } from "prom-client";
import { toHex } from "viem";
import type * as WebSocket from "ws";
import { fromZodError } from "zod-validation-error";
import type { AltoConfig } from "../createConfig";
import rpcDecorators, { RpcStatus } from "../utils/fastify-rpc-decorators";
import RpcReply from "../utils/rpc-reply";
import type { RpcHandler } from "./rpcHandler";
import fastifyCors from "@fastify/cors";

const originalJsonStringify = JSON.stringify;

JSON.stringify = (
    value: any,
    replacer?: ((this: any, key: string, value: any) => any) | (string | number)[] | null,
    space?: string | number
): string => {
    const bigintReplacer = (_key: string, value: any): any => {
        if (typeof value === "bigint") {
            return toHex(value);
        }
        return value;
    };

    const wrapperReplacer = (key: string, value: any): any => {
        if (typeof replacer === "function") {
            value = replacer(key, value);
        } else if (Array.isArray(replacer)) {
            if (!replacer.includes(key)) {
                return;
            }
        }
        return bigintReplacer(key, value);
    };

    return originalJsonStringify(value, wrapperReplacer, space);
};

export class Server {
    private readonly config: AltoConfig;
    private readonly fastify: FastifyInstance;
    private readonly rpcEndpoint: RpcHandler;
    private readonly registry: Registry;
    private readonly metrics: Metrics;

    constructor({
        config,
        rpcEndpoint,
        registry,
        metrics
    }: {
        config: AltoConfig;
        rpcEndpoint: RpcHandler;
        registry: Registry;
        metrics: Metrics;
    }) {
        this.config = config;
        const logger = config.getLogger(
            { module: "rpc" },
            { level: config.rpcLogLevel || config.logLevel }
        );

        this.fastify = Fastify({
            logger: logger as FastifyBaseLogger,
            requestTimeout: config.timeout,
            disableRequestLogging: true
        });

        this.rpcEndpoint = rpcEndpoint;
        this.registry = registry;
        this.metrics = metrics;
    }

    public async start(): Promise<void> {
        await this.fastify.register(fastifyCors, {
            origin: "*",
            methods: ["POST", "GET", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
            preflight: true
        });

        // Register other plugins
        await this.fastify.register(rpcDecorators);
        await this.fastify.register(websocket, {
            options: {
                maxPayload: this.config.websocketMaxPayloadSize
            }
        });

        // Metrics hook
        this.fastify.addHook("onResponse", (request, reply) => {
            const ignoredRoutes = ["/health", "/metrics"];
            if (ignoredRoutes.includes(request.routeOptions.url)) return;

            const labels = {
                route: request.routeOptions.url,
                code: reply.statusCode,
                method: request.method,
                rpc_method: request.rpcMethod,
                rpc_status: reply.rpcStatus
            };

            this.metrics.httpRequests.labels(labels).inc();
            const durationSeconds = reply.elapsedTime / 1000;
            this.metrics.httpRequestsDuration.labels(labels).observe(durationSeconds);
        });

        // Routes
        this.fastify.post("/rpc", this.rpcHttp.bind(this));
        this.fastify.post("/:version/rpc", this.rpcHttp.bind(this));
        this.fastify.post("/", this.rpcHttp.bind(this));

        if (this.config.websocket) {
            this.fastify.register((fastify) => {
                fastify.route({
                    method: "GET",
                    url: "/:version/rpc",
                    handler: async (request, reply) => {
                        const version = (request.params as any).version;
                        await reply
                            .status(404)
                            .send(`GET /${version}/rpc not supported, use POST`);
                    },
                    wsHandler: (socket: WebSocket.WebSocket, request) => {
                        socket.on("message", async (msgBuffer: Buffer) =>
                            this.rpcSocket(request, msgBuffer, socket)
                        );
                    }
                });
            });
        }

        // Health and metrics endpoints
        this.fastify.get("/health", this.healthCheck.bind(this));
        this.fastify.get("/metrics", this.serveMetrics.bind(this));

        // ✅ Start listening
        await this.fastify.listen({ port: this.config.port, host: "0.0.0.0" });
        console.log(`🚀 Bundler running at http://127.0.0.1:${this.config.port}`);
    }

    public async stop(): Promise<void> {
        await this.fastify.close();
    }

    public async healthCheck(
        _request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        await reply.status(200).send("OK");
    }

    private async rpcSocket(
        request: FastifyRequest,
        msgBuffer: Buffer,
        socket: WebSocket.WebSocket
    ): Promise<void> {
        try {
            request.body = JSON.parse(msgBuffer.toString());
        } catch {
            socket.send(
                JSON.stringify({
                    jsonrpc: "2.0",
                    id: null,
                    error: {
                        message: "invalid JSON-RPC request",
                        data: msgBuffer.toString(),
                        code: ERC7769Errors.InvalidFields
                    }
                })
            );
            return;
        }

        await this.rpc(request, RpcReply.fromSocket(socket));
    }

    private async rpcHttp(
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        await this.rpc(request, RpcReply.fromHttpReply(reply));
    }

    private async rpc(request: FastifyRequest, reply: RpcReply): Promise<void> {
        let requestId: number | null = null;

        const versionParsingResult = altoVersions.safeParse(
            (request.params as any)?.version ?? this.config.defaultApiVersion
        );

        if (!versionParsingResult.success) {
            const error = fromZodError(versionParsingResult.error);
            throw new RpcError(
                `invalid version ${error.message}`,
                ERC7769Errors.InvalidFields
            );
        }

        const apiVersion: ApiVersion = versionParsingResult.data;

        if (!this.config.apiVersion.includes(apiVersion)) {
            throw new RpcError(
                `unsupported version ${apiVersion}`,
                ERC7769Errors.InvalidFields
            );
        }

        try {
            const contentTypeHeader = request.headers["content-type"];

            if (
                contentTypeHeader !== "application/json" &&
                request.ws === false
            ) {
                throw new RpcError(
                    "invalid content-type, must be application/json",
                    ERC7769Errors.InvalidFields
                );
            }

            this.fastify.log.trace(
                { body: JSON.stringify(request.body) },
                "received request"
            );

            const jsonRpcParsing = jsonRpcSchema.safeParse(request.body);
            if (!jsonRpcParsing.success) {
                const validationError = fromZodError(jsonRpcParsing.error);
                throw new RpcError(
                    `invalid JSON-RPC request ${validationError.message}`,
                    ERC7769Errors.InvalidFields
                );
            }

            const jsonRpcRequest = jsonRpcParsing.data;
            requestId = jsonRpcRequest.id;

            const bundlerRequestParsing =
                bundlerRequestSchema.safeParse(jsonRpcRequest);
            if (!bundlerRequestParsing.success) {
                const validationError = fromZodError(bundlerRequestParsing.error);
                if (validationError.message.includes("Missing/invalid userOpHash")) {
                    throw new RpcError(
                        "Missing/invalid userOpHash",
                        ERC7769Errors.InvalidFields
                    );
                }
                throw new RpcError(
                    validationError.message,
                    ERC7769Errors.InvalidRequest
                );
            }

            const bundlerRequest = bundlerRequestParsing.data;
            request.rpcMethod = bundlerRequest.method;

            if (
                this.config.rpcMethods !== null &&
                !this.config.rpcMethods.includes(bundlerRequest.method)
            ) {
                throw new RpcError(
                    `Method not supported: ${bundlerRequest.method}`,
                    ERC7769Errors.InvalidRequest
                );
            }

            this.fastify.log.info(
                {
                    data: JSON.stringify(bundlerRequest, null),
                    method: bundlerRequest.method
                },
                "incoming request"
            );

            const result = await this.rpcEndpoint.handleMethod(
                bundlerRequest,
                apiVersion
            );

            const jsonRpcResponse: JSONRPCResponse = {
                jsonrpc: "2.0",
                id: jsonRpcRequest.id,
                result
            };

            await reply
                .setRpcStatus(RpcStatus.Success)
                .status(200)
                .send(jsonRpcResponse);

            this.fastify.log.info(
                {
                    data:
                        bundlerRequest.method === "eth_getUserOperationReceipt" &&
                        jsonRpcResponse.result
                            ? { ...jsonRpcResponse, result: "<reduced>" }
                            : jsonRpcResponse,
                    method: bundlerRequest.method
                },
                "sent reply"
            );
        } catch (err) {
            if (err instanceof RpcError) {
                const rpcError = {
                    jsonrpc: "2.0",
                    id: requestId,
                    error: {
                        message: err.message,
                        data: err.data,
                        code: err.code
                    }
                };
                await reply
                    .setRpcStatus(RpcStatus.ClientError)
                    .status(200)
                    .send(rpcError);
                this.fastify.log.info(rpcError, "error reply");
            } else if (err instanceof Error) {
                sentry.captureException(err);
                const rpcError = {
                    jsonrpc: "2.0",
                    id: requestId,
                    error: {
                        message: err.message
                    }
                };
                await reply
                    .setRpcStatus(RpcStatus.ServerError)
                    .status(500)
                    .send(rpcError);
                this.fastify.log.error(err, "error reply (non-rpc)");
            } else {
                const rpcError = {
                    jsonrpc: "2.0",
                    id: requestId,
                    error: { message: "Unknown error" }
                };
                await reply
                    .setRpcStatus(RpcStatus.ServerError)
                    .status(500)
                    .send(rpcError);
                this.fastify.log.error({ err }, "error reply (unhandled type)");
            }
        }
    }

    public async serveMetrics(
        _request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        reply.headers({ "Content-Type": this.registry.contentType });
        const metrics = await this.registry.metrics();
        await reply.send(metrics);
    }
}
