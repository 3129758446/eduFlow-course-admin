import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { ok } from '../common/api-response';
import { PERMISSIONS } from '../permissions/permissions.constants';
import { CourseCategoriesService } from './course-categories.service';
import { SaveCourseCategoryDto } from './dto/course-category.dto';

@Controller('api/course-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CourseCategoriesController {
  constructor(private readonly courseCategoriesService: CourseCategoriesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.COURSES_VIEW)
  async list(@Query('keyword') keyword?: string) {
    return ok(await this.courseCategoriesService.list(keyword));
  }

  @Post()
  @RequirePermission(PERMISSIONS.COURSES_UPDATE)
  async create(@Body() body: SaveCourseCategoryDto, @Res({ passthrough: true }) res: Response) {
    res.status(201);
    return ok(await this.courseCategoriesService.create(body));
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.COURSES_UPDATE)
  async update(@Param('id') id: string, @Body() body: SaveCourseCategoryDto) {
    return ok(await this.courseCategoriesService.update(id, body));
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.COURSES_UPDATE)
  async delete(@Param('id') id: string) {
    await this.courseCategoriesService.delete(id);
    return ok(null, '课程分类删除成功');
  }
}
