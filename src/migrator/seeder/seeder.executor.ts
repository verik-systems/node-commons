/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { DataSource, MssqlParameter, ObjectLiteral, QueryRunner, Table, TypeORMError } from "typeorm"
import { SqlServerDriver } from "typeorm/driver/sqlserver/SqlServerDriver"
import { RdbmsSchemaBuilder } from "typeorm/schema-builder/RdbmsSchemaBuilder"
import { SeedInterface } from "./seeder.types"

export class Seed {
  /**
   * Seed id.
   * Indicates order of the executed seeds.
   */
  id: number | undefined

  /**
   * Timestamp of the seed.
   */
  timestamp: number

  /**
   * Name of the seed (class name).
   */
  name: string

  /**
   * Seed instance that needs to be run.
   */
  instance: SeedInterface | null

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(id: number | undefined, timestamp: number, name: string, instance?: SeedInterface) {
    this.id = id
    this.timestamp = timestamp
    this.name = name
    this.instance = instance ? instance : null
  }
}

/**
 * Executes seeds: runs pending and reverts previously executed seeds.
 */
export class SeedExecutor {
  transaction: "all" | "none" | "each" = "all"

  private readonly seedsTable: string
  private readonly seedsTableName: string

  constructor(protected dataSource: DataSource) {
    this.seedsTableName = "seed"
    this.seedsTable = this.dataSource.driver.buildTableName(this.seedsTableName)
  }

  /**
   * Returns an array of all seeds.
   */
  public async getAllSeeds(seeds: SeedInterface[]): Promise<Seed[]> {
    return Promise.resolve(this.getSeeds(seeds))
  }

  /**
   * Returns an array of all executed seeds.
   */
  public async getExecutedSeeds(): Promise<Seed[]> {
    return this.withQueryRunner(async (queryRunner) => {
      await this.createSeedsTableIfNotExist(queryRunner)

      return await this.loadExecutedSeeds(queryRunner)
    })
  }

  /**
   * Returns an array of all pending seeds.
   */
  public async getPendingSeeds(seeds: SeedInterface[]): Promise<Seed[]> {
    const allSeeds = await this.getAllSeeds(seeds)
    const executedSeeds = await this.getExecutedSeeds()

    return allSeeds.filter((seed) => !executedSeeds.find((executedSeed) => executedSeed.name === seed.name))
  }

  /**
   * Inserts an executed seed.
   */
  public insertSeed(seed: Seed): Promise<void> {
    return this.withQueryRunner((q) => this.insertExecutedSeed(q, seed))
  }

  /**
   * Lists all seeds and whether they have been executed or not
   * returns true if there are unapplied seeds
   */
  async showSeeds(seeds: SeedInterface[]): Promise<boolean> {
    let hasUnappliedSeeds = false
    const queryRunner = this.dataSource.createQueryRunner()
    // create seeds table if its not created yet
    await this.createSeedsTableIfNotExist(queryRunner)
    // get all seeds that are executed and saved in the database
    const executedSeeds = await this.loadExecutedSeeds(queryRunner)

    // get all user's seeds in the source code
    const allSeeds = this.getSeeds(seeds)

    for (const seed of allSeeds) {
      const executedSeed = executedSeeds.find((executedSeed) => executedSeed.name === seed.name)

      if (executedSeed) {
        this.dataSource.logger.logSchemaBuild(` [X] ${seed.name}`)
      } else {
        hasUnappliedSeeds = true
        this.dataSource.logger.logSchemaBuild(` [ ] ${seed.name}`)
      }
    }

    // if query runner was created by us then release it
    await queryRunner.release()

    return hasUnappliedSeeds
  }

  /**
   * Executes all pending seeds. Pending seeds are seeds that are not yet executed,
   * thus not saved in the database.
   */
  async executePendingSeeds(seeds: SeedInterface[], packageVersion: string): Promise<Seed[]> {
    const queryRunner = this.dataSource.createQueryRunner()
    // create seeds table if its not created yet
    await this.createSeedsTableIfNotExist(queryRunner)

    // create the typeorm_metadata table if necessary
    const schemaBuilder = this.dataSource.driver.createSchemaBuilder()

    if (schemaBuilder instanceof RdbmsSchemaBuilder) {
      await schemaBuilder.createMetadataTableIfNecessary(queryRunner)
    }

    // get all seeds that are executed and saved in the database
    const executedSeeds = await this.loadExecutedSeeds(queryRunner)

    // get the time when last seed was executed
    const lastTimeExecutedSeed = this.getLatestTimestampSeed(executedSeeds)

    // get all user's seeds in the source code
    const allSeeds = this.getSeeds(seeds)

    // variable to store all seeds we did successefuly
    const successSeeds: Seed[] = []

    // find all seeds that needs to be executed
    const pendingSeeds = allSeeds.filter((seed) => {
      // check if we already have executed seed
      const executedSeed = executedSeeds.find((executedSeed) => executedSeed.name === seed.name)
      if (executedSeed) return false

      // seed is new and not executed. now check if its timestamp is correct
      // if (lastTimeExecutedSeed&& seed.timestamp < lastTimeExecutedSeed.timestamp)
      //     throw new TypeORMError(`New seed found: ${seed.name}, however this seed's timestamp is not valid. Seed's timestamp should not be older then seeds already executed in the database.`);

      // every check is passed means that seed was not run yet and we need to run it
      return true
    })

    // if no seeds are pending then nothing to do here
    if (!pendingSeeds.length) {
      this.dataSource.logger.logSchemaBuild(`No seeds are pending`)
      // if query runner was created by us then release it
      await queryRunner.release()
      return []
    }

    // log information about seed execution
    this.dataSource.logger.logSchemaBuild(`${executedSeeds.length} seeds are already loaded in the database.`)
    this.dataSource.logger.logSchemaBuild(`${allSeeds.length} seeds were found in the source code.`)
    if (lastTimeExecutedSeed)
      this.dataSource.logger.logSchemaBuild(
        `${lastTimeExecutedSeed.name} is the last executed seed. It was executed on ${new Date(
          lastTimeExecutedSeed.timestamp,
        ).toString()}.`,
      )
    this.dataSource.logger.logSchemaBuild(`${pendingSeeds.length} seeds are new seeds that needs to be executed.`)

    // start transaction if its not started yet
    let transactionStartedByUs = false
    if (this.transaction === "all" && !queryRunner.isTransactionActive) {
      await queryRunner.startTransaction()
      transactionStartedByUs = true
    }

    // run all pending seeds in a sequence
    try {
      for (const seed of pendingSeeds) {
        if (!seed.instance) {
          continue
        }

        if (
          seed.instance.version !== "none" &&
          seed.instance.version !== "all" &&
          seed.instance.version !== packageVersion
        ) {
          continue
        }

        if (this.transaction === "each" && !queryRunner.isTransactionActive) {
          await queryRunner.startTransaction()
          transactionStartedByUs = true
        }

        await seed.instance
          .up(queryRunner)
          .catch((error) => {
            // informative log about seed failure
            this.dataSource.logger.logMigration(`Seed"${seed.name}" failed, error: ${error?.message}`)
            throw error
          })
          .then(async () => {
            // now when seed is executed we need to insert record about it into the database
            if (seed.instance && seed.instance.version !== "all") {
              await this.insertExecutedSeed(queryRunner, seed)
            }
            // commit transaction if we started it
            if (this.transaction === "each" && transactionStartedByUs) await queryRunner.commitTransaction()
          })
          .then(() => {
            // informative log about seed success
            successSeeds.push(seed)
            this.dataSource.logger.logSchemaBuild(`Seed${seed.name} has been executed successfully.`)
          })
      }

      // commit transaction if we started it
      if (this.transaction === "all" && transactionStartedByUs) await queryRunner.commitTransaction()
    } catch (err) {
      // rollback transaction if we started it
      if (transactionStartedByUs) {
        try {
          // we throw original error even if rollback thrown an error
          await queryRunner.rollbackTransaction()
          /* eslint-disable no-empty */
        } catch (rollbackError) {}
      }

      throw err
    } finally {
      // if query runner was created by us then release it
      await queryRunner.release()
    }
    return successSeeds
  }

  // -------------------------------------------------------------------------
  // Protected Methods
  // -------------------------------------------------------------------------

  /**
   * Creates table "seeds" that will store information about executed seeds.
   */
  protected async createSeedsTableIfNotExist(queryRunner: QueryRunner): Promise<void> {
    const tableExist = await queryRunner.hasTable(this.seedsTable) // todo: table name should be configurable
    if (!tableExist) {
      await queryRunner.createTable(
        new Table({
          name: this.seedsTable,
          columns: [
            {
              name: "id",
              type: this.dataSource.driver.normalizeType({ type: this.dataSource.driver.mappedDataTypes.migrationId }),
              isGenerated: true,
              generationStrategy: "increment",
              isPrimary: true,
              isNullable: false,
            },
            {
              name: "timestamp",
              type: this.dataSource.driver.normalizeType({
                type: this.dataSource.driver.mappedDataTypes.migrationTimestamp,
              }),
              isPrimary: false,
              isNullable: false,
            },
            {
              name: "name",
              type: this.dataSource.driver.normalizeType({
                type: this.dataSource.driver.mappedDataTypes.migrationName,
              }),
              isNullable: false,
            },
          ],
        }),
      )
    }
  }

  /**
   * Loads all seeds that were executed and saved into the database (sorts by id).
   */
  protected async loadExecutedSeeds(queryRunner: QueryRunner): Promise<Seed[]> {
    const seedsRaw: ObjectLiteral[] = await this.dataSource.manager
      .createQueryBuilder(queryRunner)
      .select()
      .orderBy(this.dataSource.driver.escape("id"), "DESC")
      .from(this.seedsTable, this.seedsTableName)
      .getRawMany()
    return seedsRaw.map((seedRaw) => {
      return new Seed(parseInt(seedRaw["id"]), parseInt(seedRaw["timestamp"]), seedRaw["name"])
    })
  }

  /**
   * Gets all seeds that setup for this connection.
   */
  protected getSeeds(seeds: SeedInterface[]): Seed[] {
    const mapSeeds = seeds.map((seed) => {
      const seedClassName = seed.name || (seed.constructor as any).name
      const seedTimestamp = parseInt(seedClassName.substr(-13), 10)
      if (!seedTimestamp || isNaN(seedTimestamp)) {
        throw new TypeORMError(
          `${seedClassName} seed name is wrong. Seedclass name should have a JavaScript timestamp appended.`,
        )
      }

      return new Seed(undefined, seedTimestamp, seedClassName, seed)
    })

    this.checkForDuplicateSeeds(mapSeeds)

    // sort them by timestamp
    return mapSeeds.sort((a, b) => a.timestamp - b.timestamp)
  }

  protected checkForDuplicateSeeds(seeds: Seed[]) {
    const seedNames = seeds.map((seed) => seed.name)
    const duplicates = Array.from(new Set(seedNames.filter((seedName, index) => seedNames.indexOf(seedName) < index)))
    if (duplicates.length > 0) {
      throw Error(`Duplicate seeds: ${duplicates.join(", ")}`)
    }
  }

  /**
   * Finds the latest seed (sorts by timestamp) in the given array of seeds.
   */
  protected getLatestTimestampSeed(seeds: Seed[]): Seed | undefined {
    const sortedSeeds = seeds.map((seed) => seed).sort((a, b) => (a.timestamp - b.timestamp) * -1)
    return sortedSeeds.length > 0 ? sortedSeeds[0] : undefined
  }

  /**
   * Finds the latest seed in the given array of seeds.
   * PRE: Seedarray must be sorted by descending id.
   */
  protected getLatestExecutedSeed(sortedSeeds: Seed[]): Seed | undefined {
    return sortedSeeds.length > 0 ? sortedSeeds[0] : undefined
  }

  /**
   * Inserts new executed seed's data into seeds table.
   */
  protected async insertExecutedSeed(queryRunner: QueryRunner, seed: Seed): Promise<void> {
    const values: ObjectLiteral = {}
    if (this.dataSource.driver instanceof SqlServerDriver) {
      values["timestamp"] = new MssqlParameter(
        seed.timestamp,
        this.dataSource.driver.normalizeType({
          type: this.dataSource.driver.mappedDataTypes.migrationTimestamp,
        }) as any,
      )
      values["name"] = new MssqlParameter(
        seed.name,
        this.dataSource.driver.normalizeType({ type: this.dataSource.driver.mappedDataTypes.migrationName }) as any,
      )
    } else {
      values["timestamp"] = seed.timestamp
      values["name"] = seed.name
    }

    const qb = queryRunner.manager.createQueryBuilder()
    await qb.insert().into(this.seedsTable).values(values).execute()
  }

  protected async withQueryRunner<T>(callback: (queryRunner: QueryRunner) => T | Promise<T>) {
    const queryRunner = this.dataSource.createQueryRunner()

    try {
      return callback(queryRunner)
    } finally {
      await queryRunner.release()
    }
  }
}
