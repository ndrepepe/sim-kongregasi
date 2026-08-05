import { Module } from '@nestjs/common';
import { ChronicleController, DashboardController, FinanceController, GenericModuleController, SystemController } from './core.controllers';
import { AssignmentController } from './assignment.controller';
import { DomainService } from './domain.service';
import { InsuranceController } from './insurance.controller';
import { OrganizationController } from './organization.controller';
import { MemberController } from './member.controller';
import { IdentityController } from './identity.controller';
import { HealthController } from './health.controller';
import { FormationController } from './formation.controller';
import { WorkUnitController } from './work-unit.controller';

@Module({
  controllers: [SystemController, DashboardController, OrganizationController, MemberController, AssignmentController, IdentityController, InsuranceController, HealthController, FormationController, WorkUnitController, FinanceController, ChronicleController, GenericModuleController],
  providers: [DomainService]
})
export class DomainModule {}
