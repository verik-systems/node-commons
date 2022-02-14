import { EntitySchema, LoggerOptions } from "typeorm"

/* eslint-disable @typescript-eslint/ban-types */
export interface MigrationExtraOptions {
  entities: (Function | string | EntitySchema<any>)[]

  migrations: (Function | string)[]

  logging: LoggerOptions
}
