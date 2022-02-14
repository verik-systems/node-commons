import { Module } from "@nestjs/common"
import { MigratorService } from "./migrator.service"

@Module({
  imports: [],
  providers: [MigratorService],
})
export class MigratorModule {}
