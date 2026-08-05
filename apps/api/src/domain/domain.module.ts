import { Module } from '@nestjs/common';
import { ChronicleController, DashboardController, GenericModuleController, SystemController } from './core.controllers';
import { AssignmentController } from './assignment.controller';
import { DomainService } from './domain.service';
import { InsuranceController } from './insurance.controller';
import { OrganizationController } from './organization.controller';
import { MemberController } from './member.controller';
import { IdentityController } from './identity.controller';
import { HealthController } from './health.controller';
import { FormationController } from './formation.controller';
import { WorkUnitController } from './work-unit.controller';
import { FinanceController } from './finance.controller';
import { ArchiveController } from './archive.controller';
import { WorkflowController } from './workflow.controller';
import { CalendarController } from './calendar.controller';

@Module({
  controllers: [SystemController, DashboardController, OrganizationController, MemberController, AssignmentController, IdentityController, InsuranceController, HealthController, FormationController, WorkUnitController, FinanceController, ArchiveController, WorkflowController, CalendarController, ChronicleController, GenericModuleController],
  providers: [DomainService]
})
export class DomainModule {}
