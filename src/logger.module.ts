/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { DynamicModule, Module } from "@nestjs/common";
import { Request } from "express";
import {
  LoggerModule as BaseLoggerModule,
  LoggerModuleAsyncParams,
  Params,
} from "nestjs-pino";
import { VerikUuidUtils } from ".";
import { VerikCommonConstants } from "./constants";

@Module({})
export class VerikLoggerModule {
  public static defaultRegister() {
    return BaseLoggerModule.forRoot({
      pinoHttp: {
        level: "info",
        transport: {
          target: "pino-pretty",
        },
        useLevelLabels: true,
        autoLogging: false,
        timestamp: () => `, "time":"${new Date().toISOString()}"`,
        genReqId: (request: Request) =>
          request?.headers[VerikCommonConstants.HTTP_HEADER_X_REQUEST_ID] ||
          VerikUuidUtils.generateToken(),
      },
    });
  }

  public static registerAsync(params: LoggerModuleAsyncParams): DynamicModule {
    return BaseLoggerModule.forRootAsync(params);
  }

  public static register(params: Params): DynamicModule {
    return BaseLoggerModule.forRoot(params);
  }
}
