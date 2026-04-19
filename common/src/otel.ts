import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

import { Context, context, Histogram, metrics, propagation, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { AlwaysOnSampler, BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import {
	MeterProvider,
	PeriodicExportingMetricReader
} from "@opentelemetry/sdk-metrics";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { type FastifyReply, type FastifyRequest, type HookHandlerDoneFunction } from "fastify";

import { getLogger } from "./logger.js";

// import { ExportResult } from "@opentelemetry/core";

export interface OtelConfig {
	readonly serviceNamespace: string;
	readonly serviceName: string;
	readonly endpointUrl?: string;
}

export const setupTracing = (config: OtelConfig) => {
	const logger = getLogger("setupTracing");

	const traceCollectorUrl = `${config.endpointUrl}/v1/traces`;

	const collectorOptions = {
		url: traceCollectorUrl // url is optional and can be omitted - default is http://localhost:4318/v1/metrics
	};
	const traceExporter = new OTLPTraceExporter(collectorOptions); // new ConsoleSpanExporter();

	//
	// DEBUG the Exporter:
	//
	// const originalExport = traceExporter.export.bind(traceExporter);
	// traceExporter.export = (metrics, resultCallback) => {
	// 	console.log("Exporting metrics:", metrics);
	// 	return originalExport(metrics, (result: ExportResult) => {
	// 		if (result.error) {
	// 			logger.error("Export failed:", result.error);
	// 		} else {
	// 			logger.debug("Export succeeded");
	// 		}
	// 		resultCallback(result);
	// 	});
	// };

	const traceProvider = new NodeTracerProvider({
		resource: resourceFromAttributes({
			"service.namespace": config.serviceNamespace,
			[ATTR_SERVICE_NAME]: config.serviceName
		}),
		spanProcessors: [new BatchSpanProcessor(traceExporter)],
		sampler: new AlwaysOnSampler()
	});

	propagation.setGlobalPropagator(new W3CTraceContextPropagator());

	traceProvider.register();

	// Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
	trace.setGlobalTracerProvider(traceProvider);

	logger.debug("tracing setup");
};

export const setupMetrics = (config: OtelConfig) => {
	const resource = defaultResource().merge(
		resourceFromAttributes({
			"service.namespace": config.serviceNamespace,
			[ATTR_SERVICE_NAME]: config.serviceName
		})
	);

	const metricCollectorUrl = `${config.endpointUrl}/v1/metrics`;

	const collectorOptions = {
		url: metricCollectorUrl, // url is optional and can be omitted - default is http://localhost:4318/v1/metrics
		concurrencyLimit: 1 // an optional limit on pending requests
	};
	const metricExporter = new OTLPMetricExporter(collectorOptions);

	//
	// DEBUG the Exporter:
	//
	// const originalExport = metricExporter.export.bind(metricExporter);
	// metricExporter.export = (metrics, resultCallback) => {
	// 	console.log("Exporting metrics:", metrics);
	// 	return originalExport(metrics, (result: ExportResult) => {
	// 		if (result.error) {
	// 			logger.error("Export failed:", { metricCollectorUrl }, result.error);
	// 		} else {
	// 			console.log("Export succeeded");
	// 		}
	// 		resultCallback(result);
	// 	});
	// };

	const meterProvider = new MeterProvider({
		resource,
		readers: [
			new PeriodicExportingMetricReader({
				exporter: metricExporter,
				exportIntervalMillis: 1000
			})
		]
	});

	// Set this MeterProvider to be global to the app being instrumented.
	metrics.setGlobalMeterProvider(meterProvider);
};

export const tracingMiddleWare = (_scope: string) => (req: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => {
	const activeContext: Context = propagation.extract(context.active(), req.headers);
	context.with(activeContext, done);
};

export const injectTraceData = (): Record<string, string> => {
	const carrier: Record<string, string> = {};
	propagation.inject(context.active(), carrier);
	return carrier;
};

export const extractTraceData = (carrier: Record<string, string>): Context => {
	return propagation.extract(context.active(), carrier);
};

export const injectIntoHeaders = (headers: Record<string, string> = {}): Record<string, string> => {
	propagation.inject(context.active(), headers);
	return headers;
};

export const createHistogram = (otelScope: string, name: string, description: string, unit: string, options = {}): Histogram => {
	const meter = metrics.getMeter(otelScope);

	return meter.createHistogram(name, {
		...options,
		description,
		unit: "{call}"
	});
};

export const createOtelConfig = (envNamePrefix: string, otlpServiceName: string): OtelConfig => {
	return {
		serviceNamespace: process.env[`${envNamePrefix}OTLP_SERVICE_NAMESPACE`] ?? "bitkit/wsgw",
		serviceName: process.env[`${envNamePrefix}OTLP_SERVICE_NAME`] ?? otlpServiceName,
		endpointUrl: process.env[`${envNamePrefix}OTLP_ENDPOINT`]
	};
};
