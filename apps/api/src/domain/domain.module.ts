import { Module } from '@nestjs/common';
import { AssignmentController, ChronicleController, DashboardController, FinanceController, GenericModuleController, HealthController, SisterController, SystemController } from './core.controllers';
import { DomainService } from './domain.service';
import { InsuranceController } from './insurance.controller';
import { OrganizationController } from './organization.controller';

@Module({
  controllers: [SystemController, DashboardController, OrganizationController, SisterController, AssignmentController, InsuranceController, HealthController, FinanceController, ChronicleController, GenericModuleController],
  providers: [DomainService]
})
export class DomainModule {}
