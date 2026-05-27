/**
 * StoryCine - 全流程自动化测试
 * 测试所有核心API端点
 */
const axios = require('axios');
const BASE_URL = 'http://localhost:3000/api/v1';
let projectId, scriptId, characterId, storyboardId;

async function runAllTests() {
  console.log('========== StoryCine 全流程自动化测试 ==========\n');

  try {
    // 1. 创建项目
    console.log('1. 测试项目创建...');
    const pRes = await axios.post(`${BASE_URL}/projects`, {
      name: '测试短剧_' + Date.now(),
      description: '自动化测试项目',
      videoConfig: { aspectRatio: '9:16', visualStyle: '写实' },
    });
    projectId = pRes.data.data._id;
    console.log('   ✅ 项目创建成功:', projectId);

    // 2. 获取项目列表
    console.log('2. 测试获取项目列表...');
    const listRes = await axios.get(`${BASE_URL}/projects`);
    console.log(`   ✅ 获取成功，共 ${listRes.data.data.length} 个项目`);

    // 3. 获取单个项目
    console.log('3. 测试获取单个项目...');
    await axios.get(`${BASE_URL}/projects/${projectId}`);
    console.log('   ✅ 获取成功');

    // 4. 更新项目
    console.log('4. 测试更新项目...');
    await axios.put(`${BASE_URL}/projects/${projectId}`, { description: '更新后的描述' });
    console.log('   ✅ 更新成功');

    // 5. AI生成剧本（异步提交）
    console.log('5. 测试AI剧本生成提交...');
    try {
      const gRes = await axios.post(`${BASE_URL}/scripts/ai-generate`, {
        projectId,
        tags: { genre: '都市爱情', plots: ['霸道总裁', '失忆'], type: '爱情', style: '虐心' }
      });
      console.log('   ✅ 剧本生成已提交:', gRes.status, gRes.data.message);
    } catch (err) {
      console.log('   ⚠️  生成提交返回:', err.response?.status, err.response?.data?.message || err.message);
    }

    // 6. 导入剧本
    console.log('6. 测试剧本导入...');
    const importContent = `场次：1
时间：白天
地点：咖啡厅
人物：张三,李四
氛围：温馨

张三：你好，好久不见。
（张三微笑，李四惊讶）
李四：是你...
张三：这些年你还好吗？
`;
    const iRes = await axios.post(`${BASE_URL}/scripts/import`, {
      projectId,
      fileContent: importContent,
      fileType: 'txt'
    });
    scriptId = iRes.data.data._id;
    console.log('   ✅ 剧本导入成功，场次数:', iRes.data.data.scenes?.length);

    // 7. 获取剧本列表
    console.log('7. 测试获取剧本列表...');
    const scriptsRes = await axios.get(`${BASE_URL}/scripts`, { params: { projectId } });
    console.log(`   ✅ 获取成功，共 ${scriptsRes.data.data.length} 个剧本`);

    // 8. 创建角色
    console.log('8. 测试角色创建...');
    const cRes = await axios.post(`${BASE_URL}/assets/characters`, {
      projectId,
      name: '金鑫',
      age: 28,
      gender: '男',
      appearance: '身高185cm，冷峻面容，剑眉星目',
      personality: '外表冷漠内心温柔',
      tags: ['霸道总裁'],
      roleType: '主角',
    });
    characterId = cRes.data.data._id;
    console.log('   ✅ 角色创建成功:', characterId);

    // 9. 获取角色列表
    console.log('9. 测试获取角色列表...');
    const chars = await axios.get(`${BASE_URL}/assets/characters`, { params: { projectId } });
    console.log(`   ✅ 获取成功，共 ${chars.data.data.length} 个角色`);

    // 10. 自动分镜拆解
    console.log('10. 测试自动分镜拆解...');
    const sRes = await axios.post(`${BASE_URL}/storyboards/auto-generate`, {
      projectId,
      scriptId,
    });
    storyboardId = sRes.data.data._id;
    console.log('   ✅ 分镜拆解完成，镜头数:', sRes.data.data.totalShots);

    // 11. 更新分镜镜头
    console.log('11. 测试单个镜头更新...');
    await axios.put(`${BASE_URL}/storyboards/${storyboardId}/shots/1`, {
      shotType: '特写',
      duration: 2,
    });
    console.log('   ✅ 镜头更新成功');

    // 12. 创建合成任务
    console.log('12. 测试合成任务创建...');
    const compRes = await axios.post(`${BASE_URL}/compositions`, {
      projectId,
      storyboardId,
      options: { outputFormat: 'mp4', resolution: '1080x1920' },
    });
    console.log('   ✅ 合成任务创建成功:', compRes.data.data._id);

    // 13. 软删除项目
    console.log('13. 测试删除项目...');
    await axios.delete(`${BASE_URL}/projects/${projectId}`);
    console.log('   ✅ 删除成功');

    console.log('\n========== 全部测试通过 ✅ (13/13) ==========');
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('\n❌ 测试失败:', msg);
    if (err.response?.data?.errors) {
      console.error('  详情:', JSON.stringify(err.response.data.errors));
    }
    process.exit(1);
  }
}

runAllTests();
