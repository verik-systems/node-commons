import { QueryRunner } from "typeorm"

export interface SeederExtraOptions {
  seeds: SeedInterface[]

  dir: string

  packageVersion: string
}

export interface SeedInterface {
  /**
   * Optional seed name, defaults to class name.
   */
  name?: string

  /**
   * all is not save file seed in table seed and always run this file
   * none is check file in table ? if not exist then run this file else nothing todo
   * value !== all and value !== none if current package version === value => run this file
   */
  version: "none" | "all" | string

  up(queryRunner: QueryRunner): Promise<any>
}
