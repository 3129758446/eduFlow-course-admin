// 文件作用：工作台接口控制器，按权限返回首页统计与趋势图数据。
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { ok } from '../common/api-response';
import { PERMISSIONS } from '../permissions/permissions.constants';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // 作用：返回工作台统计和图表数据，进入首页时需要 dashboard:view 权限。

  @Get()
  @RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
  async dashboard() {
    return ok(await this.dashboardService.getDashboard());
  }
}
