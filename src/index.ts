import { Context, Schema, Session } from 'koishi';
import cheerio from 'cheerio';
import {} from 'koishi-plugin-puppeteer';

export const name = 'apexMap';
export const inject = ['puppeteer'] as const;

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

// 定义地图名称的中文映射表
const mapNameTranslations = {
   'World\'s Edge': '世界尽头',
   'Kings Canyon': '诸王峡谷',
   'Storm Point': '风暴点',
   'Olympus': '奥林匹斯',
   'Broken Moon': '破碎月亮',
   'Fragment': '碎片',
   'Barometer': '晴雨表',
   'Overflow': '溢出',
   'Zeus Station': '宙斯站',
   'Caustic Treatment': '侵蚀疗法',
   'Wattson\'s Pylon': '华森塔',
   'Skulltown': '骷髅镇',
   'Siphon': '熔岩虹吸',
   'Party crasher': '派对破坏者',
   'TDM': '团队死斗',
   'Gun Run': '子弹时间',
   'Control': '控制',
   // ...添加其他地图名称的映射
  };

// 地图名称翻译函数
function translateMapName(englishMapName) {
  return mapNameTranslations[englishMapName] || englishMapName;
}

export function apply(ctx: Context) {
  ctx.command('apexmap', '获取Apex Legends地图信息')
    .action(async ({ session }) => {
      let page = await ctx.puppeteer.page();

      // 打开 Apex Legends 混合模式的地图表
      await page.goto('https://apexlegendsstatus.com/current-map/ltm/pubs', { waitUntil: 'networkidle0' });

      // 获取网页内容
      let content = await page.content();
      await page.close();

      // 使用 Cheerio 解析 HTML
      let $ = cheerio.load(content);

      // 从页面中提取地图和玩法的映射关系
      const maps = [];
      $('div.row > div').each((index, element) => {
        const mapElement = $(element).find('h3');
        // 检查是否找到了 h3 元素并且文本中包含 ' - '
        if (mapElement.length === 0 || !mapElement.text().includes(' - ')) {
          return; // 跳过当前元素
        }
      
        const mapNameMode = mapElement.text().split(' - ');
        const mapName = mapNameMode[0].trim();
        const mode = mapNameMode[1].trim();
        maps.push({ mapName, mode });
      });
      

      // 在这里，maps 变量包含了地图和玩法的映射关系
      // 创建一个映射对象用于存储去重后的地图和模式
      const uniqueMaps = {};

      // 遍历 maps 数组，并将不重复的地图和模式添加到 uniqueMaps 对象中
      maps.forEach(map => {
        if (!uniqueMaps[map.mapName]) {
          uniqueMaps[map.mapName] = map.mode;
        }
      });

      // 转换 uniqueMaps 对象为数组格式
      const uniqueMapsArray = Object.entries(uniqueMaps).map(([mapName, mode]) => {
        return { mapName, mode };
      });

      // 将 uniqueMapsArray 转换为键值对映射对象
      const mapModeMappings = uniqueMapsArray.reduce((acc, cur) => {
        acc[cur.mapName] = cur.mode;
        return acc;
      }, {});

      page = await ctx.puppeteer.page();
      // 打开 Apex Legends 当前地图网站
      await page.goto('https://apexlegendsstatus.com/current-map', { waitUntil: 'networkidle0' });

      await page.waitForFunction(
        () => {
          // 确保所有计时器加载完成
          const timer = document.querySelector('div[onclick*="/current-map/battle_royale/pubs"] h2[id="timer"]');
          const timerRanked = document.querySelector('div[onclick*="/current-map/battle_royale/ranked"] h2[id="timer-ranked"]');
          const timerLtm = document.querySelector('div[onclick*="/current-map/ltm/pubs"] h2[id="timer-ltm"]');
          return timer && timer.textContent !== "Loading..."
              && timerRanked && timerRanked.textContent !== "Loading..."
              && timerLtm && timerLtm.textContent !== "Loading...";
        },
        { timeout: 20000 }
      );

      content = await page.content();
      await page.close();

      $ = cheerio.load(content);
      
      // 使用映射表将地图名称转换为玩法和中文名称
      function getMapModeAndChineseName(englishMapName) {
        const mode = mapModeMappings[englishMapName] || '未知模式';
        const chineseMapName = mapNameTranslations[englishMapName] || englishMapName;
        return `${translateMapName(mode)}: ${chineseMapName}`;
      }


      function extractInfo(selector: string, timerSelectorSuffix = '') {
        const div = $(selector);
        let mapName = div.find('h1[style="font-weight: 600; margin-bottom: 5px;"]').text().trim();
        const timerSelector = `h2[id="timer${timerSelectorSuffix}"]`;
        const timeRemaining = div.find(timerSelector).text().trim();
        let nextMapName = div.find('h5').eq(1).find('b').text().trim(); // 获取下一个地图的名称
    
        // 对匹配模式和排位模式去除“: ”及其前面的内容
        if (timerSelectorSuffix !== '-ltm') {
          const colonIndex = mapName.indexOf(': ');
          if (colonIndex !== -1) {
              mapName = mapName.substring(colonIndex + 2);
          }
          // 将地图名称翻译成中文（如果有对应的翻译）
          mapName = translateMapName(mapName);
          nextMapName = translateMapName(nextMapName);
          return `当前地图: ${mapName}\n剩余时间: ${timeRemaining}\n下个地图: ${nextMapName}`;
        }
        else{
          // 获取并处理当前地图信息
          let [currentMode, currentMap] = mapName.split(': ');
          currentMode = translateMapName(currentMode);
          currentMap = translateMapName(currentMap);

          // 获取并处理下一个地图信息
          nextMapName = getMapModeAndChineseName(nextMapName); // 转换成“玩法: 地图名”
          let [nextMode, nextMap] = nextMapName.split(': ');
          nextMode = translateMapName(nextMode);
          nextMap = translateMapName(nextMap);
          return `当前地图: ${currentMode}: ${currentMap}\n剩余时间: ${timeRemaining}\n下个地图: ${nextMode}: ${nextMap}`;
        }
      }
    

      const pubsInfo = extractInfo('div[onclick*="/current-map/battle_royale/pubs"]');
      const rankedInfo = extractInfo('div[onclick*="/current-map/battle_royale/ranked"]', '-ranked');
      const ltmInfo = extractInfo('div[onclick*="/current-map/ltm/pubs"]', '-ltm');

      return `匹配模式:\n${pubsInfo}\n\n排位模式:\n${rankedInfo}\n\n混合模式:\n${ltmInfo}`;
    });
}
