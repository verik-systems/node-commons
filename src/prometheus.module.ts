/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { DynamicModule, Module } from "@nestjs/common"
import { PrometheusAsyncOptions, PrometheusModule, PrometheusOptions } from "@willsoto/nestjs-prometheus"

@Module({})
export class VerikPrometheusModule {
  public static register(options?: PrometheusOptions): DynamicModule {
    return PrometheusModule.register(options)
  }

  public static registerAsync(options: PrometheusAsyncOptions): DynamicModule {
    return PrometheusModule.registerAsync(options)
  }
}
