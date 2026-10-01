package com.tagmanagement.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.common.BusinessConstants;
import com.tagmanagement.dto.BindScanRequest;
import com.tagmanagement.dto.GenerateSampleTasksRequest;
import com.tagmanagement.dto.RecordScanRequest;
import com.tagmanagement.dto.ProjectCreateRequest;
import com.tagmanagement.dto.SampleTaskResponse;
import com.tagmanagement.dto.VerifyScanRequest;
import com.tagmanagement.entity.ProjectInfo;
import com.tagmanagement.entity.SampleTask;
import com.tagmanagement.entity.SysMenu;
import com.tagmanagement.entity.SysPermission;
import com.tagmanagement.entity.SysRole;
import com.tagmanagement.entity.SysRolePermission;
import com.tagmanagement.entity.SysUser;
import com.tagmanagement.entity.SysUserRole;
import com.tagmanagement.entity.SystemNotice;
import com.tagmanagement.mapper.ProjectInfoMapper;
import com.tagmanagement.mapper.SampleTaskMapper;
import com.tagmanagement.mapper.SysMenuMapper;
import com.tagmanagement.mapper.SysPermissionMapper;
import com.tagmanagement.mapper.SysRoleMapper;
import com.tagmanagement.mapper.SysRolePermissionMapper;
import com.tagmanagement.mapper.SysUserMapper;
import com.tagmanagement.mapper.SysUserRoleMapper;
import com.tagmanagement.mapper.SystemNoticeMapper;
import com.tagmanagement.security.CurrentUser;
import com.tagmanagement.security.CurrentUserContext;
import com.tagmanagement.service.ProjectService;
import com.tagmanagement.service.SampleTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app", name = "bootstrap-enabled", havingValue = "true")
public class DataInitializer implements ApplicationRunner {

    private final SysPermissionMapper permissionMapper;
    private final SysRoleMapper roleMapper;
    private final SysRolePermissionMapper rolePermissionMapper;
    private final SysUserMapper userMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final SysMenuMapper menuMapper;
    private final SystemNoticeMapper noticeMapper;
    private final ProjectInfoMapper projectMapper;
    private final SampleTaskMapper sampleTaskMapper;
    private final BCryptPasswordEncoder passwordEncoder;
    private final ProjectService projectService;
    private final SampleTaskService sampleTaskService;
    private final AppProperties appProperties;

    @Override
    public void run(ApplicationArguments args) {
        validateBootstrapConfiguration();
        initPermissions();
        initRoles();
        initUsers();
        initMenus();
        initNotices();
        initDemoProject();
    }

    private void validateBootstrapConfiguration() {
        requireBootstrapPassword("APP_BOOTSTRAP_ADMIN_PASSWORD", appProperties.getBootstrapAdminPassword());
        requireBootstrapPassword("APP_BOOTSTRAP_TECH_PASSWORD", appProperties.getBootstrapTechPassword());
        requireBootstrapPassword("APP_BOOTSTRAP_ANALYST_PASSWORD", appProperties.getBootstrapAnalystPassword());
        requireBootstrapPassword("APP_BOOTSTRAP_AUDITOR_PASSWORD", appProperties.getBootstrapAuditorPassword());
    }

    private void initPermissions() {
        Map<String, String[]> permissions = new LinkedHashMap<>();
        permissions.put("*", new String[]{"全部权限", "系统"});
        permissions.put("project:view", new String[]{"查看项目", "项目"});
        permissions.put("project:create", new String[]{"创建项目", "项目"});
        permissions.put("sample:view", new String[]{"查看采样任务", "采样"});
        permissions.put("sample:generate", new String[]{"生成采样任务", "采样"});
        permissions.put("sample:bind", new String[]{"贴标绑定", "扫码"});
        permissions.put("sample:verify", new String[]{"操作核对", "扫码"});
        permissions.put("sample:record", new String[]{"录入确认", "扫码"});
        permissions.put("label:view", new String[]{"查看标签预览", "标签"});
        permissions.put("record:view", new String[]{"查看扫码记录", "追溯"});
        permissions.put("exception:view", new String[]{"查看异常拦截", "追溯"});
        permissions.put("report:view", new String[]{"查看统计报表", "报表"});
        permissions.put("audit:view", new String[]{"查看审计日志", "审计"});
        permissions.put("menu:view", new String[]{"查看菜单", "系统"});
        permissions.put("menu:create", new String[]{"新增菜单", "系统"});
        permissions.put("menu:update", new String[]{"更新菜单", "系统"});
        permissions.put("user:view", new String[]{"查看用户", "系统"});
        permissions.put("user:create", new String[]{"新增用户", "系统"});
        permissions.put("user:update", new String[]{"编辑用户", "系统"});
        permissions.put("user:reset-password", new String[]{"重置用户密码", "系统"});
        permissions.put("permission:view", new String[]{"查看权限", "系统"});
        permissions.put("permission:manage", new String[]{"维护权限", "系统"});
        permissions.put("role:view", new String[]{"查看角色", "系统"});
        permissions.put("role:manage", new String[]{"维护角色权限", "系统"});
        permissions.put("log:view", new String[]{"查看系统日志", "系统"});
        permissions.put("notice:view", new String[]{"查看公告", "系统"});
        permissions.put("notice:create", new String[]{"新增公告", "系统"});
        permissions.put("notice:update", new String[]{"更新公告", "系统"});
        permissions.put("notice:publish", new String[]{"发布公告", "系统"});

        permissions.forEach((code, meta) -> {
            SysPermission permission = permissionMapper.selectOne(new LambdaQueryWrapper<SysPermission>()
                    .eq(SysPermission::getPermissionCode, code));
            if (permission == null) {
                permission = new SysPermission();
                permission.setPermissionCode(code);
                permission.setPermissionName(meta[0]);
                permission.setModule(meta[1]);
                permissionMapper.insert(permission);
            }
        });
    }

    private void initRoles() {
        createRole("ADMIN", "系统管理员", "拥有全部权限", List.of("*"));
        createRole("TECHNICIAN", "实验技术员", "负责标签生成、贴标绑定、操作核对", List.of(
                "project:view", "sample:view", "sample:generate", "sample:bind", "sample:verify",
                "sample:record", "label:view", "record:view", "exception:view", "report:view"
        ));
        createRole("ANALYST", "复核/分析人员", "负责分析端录入确认", List.of(
                "project:view", "sample:view", "sample:record", "label:view", "record:view", "report:view"
        ));
        createRole("AUDITOR", "审计人员", "负责追溯和审计查询", List.of(
                "project:view", "sample:view", "label:view", "record:view", "exception:view", "report:view", "audit:view", "log:view"
        ));
    }

    private void createRole(String code, String name, String description, List<String> permissionCodes) {
        SysRole role = roleMapper.selectOne(new LambdaQueryWrapper<SysRole>().eq(SysRole::getRoleCode, code));
        if (role == null) {
            role = new SysRole();
            role.setRoleCode(code);
            role.setRoleName(name);
            role.setDescription(description);
            roleMapper.insert(role);
        }
        rolePermissionMapper.delete(new LambdaQueryWrapper<SysRolePermission>()
                .eq(SysRolePermission::getRoleId, role.getId()));

        for (String permissionCode : permissionCodes) {
            SysPermission permission = permissionMapper.selectOne(new LambdaQueryWrapper<SysPermission>()
                    .eq(SysPermission::getPermissionCode, permissionCode));
            if (permission != null) {
                SysRolePermission relation = new SysRolePermission();
                relation.setRoleId(role.getId());
                relation.setPermissionId(permission.getId());
                rolePermissionMapper.insert(relation);
            }
        }
    }

    private void initUsers() {
        createUser("admin", requireBootstrapPassword("APP_BOOTSTRAP_ADMIN_PASSWORD", appProperties.getBootstrapAdminPassword()),
                "系统管理员", "信息技术部", "ADMIN");
        createUser("tech", requireBootstrapPassword("APP_BOOTSTRAP_TECH_PASSWORD", appProperties.getBootstrapTechPassword()),
                "实验技术员", "实验技术部", "TECHNICIAN");
        createUser("analyst", requireBootstrapPassword("APP_BOOTSTRAP_ANALYST_PASSWORD", appProperties.getBootstrapAnalystPassword()),
                "分析人员", "分析检测部", "ANALYST");
        createUser("auditor", requireBootstrapPassword("APP_BOOTSTRAP_AUDITOR_PASSWORD", appProperties.getBootstrapAuditorPassword()),
                "审计人员", "质量保证部", "AUDITOR");
    }

    private String requireBootstrapPassword(String variableName, String password) {
        if (!StringUtils.hasText(password) || password.length() < 12) {
            throw new IllegalStateException(variableName + " 必须配置且长度不能少于 12 位");
        }
        return password;
    }

    private void createUser(String username, String password, String realName, String department, String roleCode) {
        SysUser user = userMapper.selectOne(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, username));
        if (user == null) {
            user = new SysUser();
            user.setUsername(username);
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setRealName(realName);
            user.setDepartment(department);
            user.setStatus(BusinessConstants.STATUS_ENABLED);
            userMapper.insert(user);
        }
        SysRole role = roleMapper.selectOne(new LambdaQueryWrapper<SysRole>().eq(SysRole::getRoleCode, roleCode));
        if (role != null && userRoleMapper.selectOne(new LambdaQueryWrapper<SysUserRole>()
                .eq(SysUserRole::getUserId, user.getId())
                .eq(SysUserRole::getRoleId, role.getId())) == null) {
            SysUserRole relation = new SysUserRole();
            relation.setUserId(user.getId());
            relation.setRoleId(role.getId());
            userRoleMapper.insert(relation);
        }
    }

    private void initMenus() {
        upsertMenu(0L, "dashboard", "工作台", "/", "DashboardPage", null, "DashboardOutlined", 10);
        upsertMenu(0L, "tasks", "采样任务", "/tasks", "SampleTasksPage", "sample:view", "ExperimentOutlined", 20);
        upsertMenu(0L, "scan", "扫码核对", "/scan", "ScanWorkbenchPage", "sample:bind", "BarcodeOutlined", 30);
        upsertMenu(0L, "label-preview", "标签预览", "/labels", "LabelPreviewPage", "label:view", "TagOutlined", 40);
        upsertMenu(0L, "records", "追溯记录", "/records", "TracePage", "record:view", "FileSearchOutlined", 50);
        upsertMenu(0L, "exceptions", "异常拦截", "/exceptions", "ExceptionInterceptionPage", "exception:view", "WarningOutlined", 60);
        upsertMenu(0L, "reports", "统计报表", "/reports", "StatisticsReportPage", "report:view", "BarChartOutlined", 70);

        SysMenu system = upsertMenu(0L, "system", "系统管理", null, "LAYOUT", null, "SettingOutlined", 90);
        upsertMenu(system.getId(), "projects", "项目管理", "/projects", "ProjectsPage", "project:view", "ProjectOutlined", 10);
        upsertMenu(system.getId(), "system-users", "用户管理", "/system/users", "UserManagementPage", "user:view", "UserOutlined", 20);
        upsertMenu(system.getId(), "system-menu", "菜单管理", "/system/menus", "MenuManagementPage", "menu:view", "MenuOutlined", 30);
        upsertMenu(system.getId(), "system-permission", "权限管理", "/system/permissions", "PermissionManagementPage", "permission:view", "SafetyCertificateOutlined", 40);
        upsertMenu(system.getId(), "system-logs", "日志管理", "/system/logs", "LogManagementPage", "log:view", "FileTextOutlined", 50);
        upsertMenu(system.getId(), "system-notices", "公告管理", "/system/notices", "NoticeManagementPage", "notice:view", "NotificationOutlined", 60);
    }

    private SysMenu upsertMenu(
            Long parentId,
            String key,
            String name,
            String routePath,
            String component,
            String permissionCode,
            String icon,
            Integer sortOrder
    ) {
        SysMenu menu = menuMapper.selectOne(new LambdaQueryWrapper<SysMenu>().eq(SysMenu::getMenuKey, key));
        if (menu == null) {
            menu = new SysMenu();
            menu.setMenuKey(key);
        }
        menu.setParentId(parentId);
        menu.setMenuName(name);
        menu.setRoutePath(routePath);
        menu.setComponent(component);
        menu.setPermissionCode(permissionCode);
        menu.setIcon(icon);
        menu.setSortOrder(sortOrder);
        menu.setVisible(true);
        menu.setStatus(BusinessConstants.STATUS_ENABLED);
        if (menu.getId() == null) {
            menuMapper.insert(menu);
        } else {
            menuMapper.updateById(menu);
        }
        return menu;
    }

    private void initNotices() {
        if (noticeMapper.selectCount(null) > 0) {
            return;
        }
        SystemNotice notice = new SystemNotice();
        notice.setTitle("采血样品标签防错系统上线试运行");
        notice.setContent("请先使用项目管理和采样任务生成标签，再进入扫码核对工作台完成贴标绑定、操作核对和录入确认。");
        notice.setNoticeType("INFO");
        notice.setPublishStatus("PUBLISHED");
        notice.setPublishedAt(LocalDateTime.now());
        notice.setCreatedBy(1L);
        noticeMapper.insert(notice);
    }

    private void initDemoProject() {
        CurrentUserContext.set(new CurrentUser(
                1L, "admin", "系统管理员", Set.of("ADMIN"), Set.of("*")
        ));
        try {
            ProjectInfo project = projectMapper.selectOne(new LambdaQueryWrapper<ProjectInfo>()
                    .eq(ProjectInfo::getProjectCode, "SN26007PK02"));
            Long projectId;
            if (project == null) {
                ProjectCreateRequest projectRequest = new ProjectCreateRequest();
                projectRequest.setProjectCode("SN26007PK02");
                projectRequest.setProjectName("采血样品防错改进演示项目");
                projectRequest.setTestArticle("供试品 A");
                projectRequest.setSponsor("内部验证");
                projectId = projectService.create(projectRequest).getId();
            } else {
                projectId = project.getId();
            }

            long taskCount = sampleTaskMapper.selectCount(new LambdaQueryWrapper<SampleTask>()
                    .eq(SampleTask::getProjectId, projectId));
            if (taskCount >= 10) {
                return;
            }

            List<SampleTaskResponse> tasks = sampleTaskService.generate(buildDemoTaskRequest(projectId));
            seedScanRecords(tasks);
        } finally {
            CurrentUserContext.clear();
        }
    }

    private GenerateSampleTasksRequest buildDemoTaskRequest(Long projectId) {
        List<GenerateSampleTasksRequest.Row> rows = List.of(
                row("312-11-PK", "312", "M", "血常规", "D1-96h", "A01"),
                row("312-12-PK", "312", "F", "生化全套", "D1-96h", "A02"),
                row("312-13-PK", "312", "M", "凝血四项", "D1-96h", "A03"),
                row("312-14-PK", "312", "F", "血型", "D1-96h", "A04"),
                row("312-15-PK", "312", "M", "尿常规", "D1-24h", "B01"),
                row("312-16-PK", "312", "F", "血培养", "D1-24h", "B02"),
                row("312-17-PK", "312", "M", "CD反应蛋白", "D2-0h", "C01"),
                row("312-18-PK", "312", "F", "钾离子", "D2-0h", "C02"),
                row("312-19-PK", "312", "M", "血气", "D2-6h", "D01"),
                row("312-20-PK", "312", "F", "血糖", "D2-6h", "D02")
        );
        GenerateSampleTasksRequest request = new GenerateSampleTasksRequest();
        request.setProjectId(projectId);
        request.setRows(rows);
        return request;
    }

    private GenerateSampleTasksRequest.Row row(
            String animalNo,
            String groupNo,
            String gender,
            String sampleType,
            String timePoint,
            String tubeNo
    ) {
        GenerateSampleTasksRequest.Row row = new GenerateSampleTasksRequest.Row();
        row.setAnimalNo(animalNo);
        row.setGroupNo(groupNo);
        row.setGender(gender);
        row.setSampleType(sampleType);
        row.setTimePoint(timePoint);
        row.setPlannedCollectDate(LocalDate.of(2026, 6, 9));
        row.setTubeNo(tubeNo);
        return row;
    }

    private void seedScanRecords(List<SampleTaskResponse> tasks) {
        for (int i = 0; i < tasks.size(); i++) {
            SampleTaskResponse task = tasks.get(i);
            bind(task);
            if (i == 2 || i == 5 || i == 8) {
                verify(task, "D1-24h-错误");
            } else if (i % 3 == 0) {
                verify(task, task.getTimePoint());
                record(task);
            } else if (i % 2 == 0) {
                verify(task, task.getTimePoint());
            }
        }
    }

    private void bind(SampleTaskResponse task) {
        BindScanRequest request = new BindScanRequest();
        request.setLabelCode(task.getLabelCode());
        request.setAnimalNo(task.getAnimalNo());
        sampleTaskService.bind(request);
    }

    private void verify(SampleTaskResponse task, String timePoint) {
        VerifyScanRequest request = new VerifyScanRequest();
        request.setLabelCode(task.getLabelCode());
        request.setProjectCode(task.getProjectCode());
        request.setAnimalNo(task.getAnimalNo());
        request.setTimePoint(timePoint);
        sampleTaskService.verify(request);
    }

    private void record(SampleTaskResponse task) {
        RecordScanRequest request = new RecordScanRequest();
        request.setLabelCode(task.getLabelCode());
        request.setResultNote("演示数据录入确认");
        sampleTaskService.record(request);
    }
}
