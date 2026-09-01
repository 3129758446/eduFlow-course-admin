// 文件作用：课程接口控制器，提供课程列表、分类、详情、新增、编辑、删除和状态切换接口。
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { ok } from '../common/api-response';
import { PERMISSIONS } from '../permissions/permissions.constants';
import { CoursesService } from './courses.service';
import { CourseListQueryDto, CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@Controller('api/courses')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // 作用：课程列表查询入口，对应前端课程表格的分页、筛选和排序。

  @Get()
  @RequirePermission(PERMISSIONS.COURSES_VIEW)
  async list(@Query() query: CourseListQueryDto) {
    return ok(await this.coursesService.list(query));
  }

  // 作用：获取课程分类，用于前端筛选下拉框。

  @Get('categories')
  @RequirePermission(PERMISSIONS.COURSES_VIEW)
  async categories() {
    return ok(await this.coursesService.categories());
  }

  // 作用：获取单个课程详情。

  @Get(':id')
  @RequirePermission(PERMISSIONS.COURSES_VIEW)
  async detail(@Param('id') id: string) {
    return ok(await this.coursesService.detail(id));
  }

  // 作用：新增课程，成功时保持旧 Koa 接口的 201 状态码。

  @Post()
  @RequirePermission(PERMISSIONS.COURSES_CREATE)
  async create(@Body() body: CreateCourseDto, @Res({ passthrough: true }) res: Response) {
    res.status(201);
    return ok(await this.coursesService.create(body));
  }

  // 作用：编辑课程信息。

  @Put(':id')
  @RequirePermission(PERMISSIONS.COURSES_UPDATE)
  async update(@Param('id') id: string, @Body() body: UpdateCourseDto) {
    return ok(await this.coursesService.update(id, body));
  }

  // 作用：删除课程记录。

  @Delete(':id')
  @RequirePermission(PERMISSIONS.COURSES_DELETE)
  async delete(@Param('id') id: string) {
    await this.coursesService.delete(id);
    return ok(null, '删除成功');
  }

  // 作用：切换课程发布状态，对应前端上下架操作。

  @Patch(':id/status')
  @RequirePermission(PERMISSIONS.COURSES_UPDATE)
  async toggleStatus(@Param('id') id: string) {
    return ok(await this.coursesService.toggleStatus(id));
  }
}
