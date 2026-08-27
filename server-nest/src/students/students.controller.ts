// 文件作用：学员接口控制器，提供学员列表、班级、学号校验、详情、新增、编辑和删除接口。
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { ok } from '../common/api-response';
import { PERMISSIONS } from '../permissions/permissions.constants';
import { StudentsService } from './students.service';

@Controller('api/students')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // 作用：学员列表查询入口，对应前端学员表格的分页和筛选。

  @Get()
  @RequirePermission(PERMISSIONS.STUDENTS_VIEW)
  async list(@Query() query: Record<string, string>) {
    return ok(await this.studentsService.list(query));
  }

  // 作用：获取班级下拉选项。

  @Get('classes')
  @RequirePermission(PERMISSIONS.STUDENTS_VIEW)
  async classes() {
    return ok(await this.studentsService.classes());
  }

  // 作用：校验学号是否重复，新增和编辑学员时使用。

  @Get('check-no')
  @RequirePermission(PERMISSIONS.STUDENTS_UPDATE)
  async checkNo(@Query('student_no') studentNo: string, @Query('excludeId') excludeId: string) {
    return ok(await this.studentsService.checkNo(studentNo, excludeId));
  }

  // 作用：获取学员详情，并返回已选课程信息。

  @Get(':id')
  @RequirePermission(PERMISSIONS.STUDENTS_VIEW)
  async detail(@Param('id') id: string) {
    return ok(await this.studentsService.detail(id));
  }

  // 作用：新增学员，成功时保持旧 Koa 接口的 201 状态码。

  @Post()
  @RequirePermission(PERMISSIONS.STUDENTS_CREATE)
  async create(@Body() body: Record<string, unknown>, @Res({ passthrough: true }) res: Response) {
    res.status(201);
    return ok(await this.studentsService.create(body));
  }

  // 作用：编辑学员资料和选课关系。

  @Put(':id')
  @RequirePermission(PERMISSIONS.STUDENTS_UPDATE)
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return ok(await this.studentsService.update(id, body));
  }

  // 作用：删除学员并由 service 同步刷新课程人数。

  @Delete(':id')
  @RequirePermission(PERMISSIONS.STUDENTS_DELETE)
  async delete(@Param('id') id: string) {
    await this.studentsService.delete(id);
    return ok(null, '删除成功');
  }
}
