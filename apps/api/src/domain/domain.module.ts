import { Module } from '@nestjs/common';
import { ChronicleController, DashboardController, FinanceController, GenericModuleController, HealthController, SystemController } from './core.controllers';
import { AssignmentController } from './assignment.controller';
import { DomainService } from './domain.service';
import { InsuranceController } from './insurance.controller';
import { OrganizationController } from './organization.controller';
import { MemberController } from './member.controller';
import { IdentityController } from './identity.controller';

@Module({
  controllers: [SystemController, DashboardController, OrganizationController, MemberController, AssignmentController, IdentityController, InsuranceController, HealthController, FinanceController, ChronicleController, GenericModuleController],
  providers: [DomainService]
})
export class DomainModule {}
