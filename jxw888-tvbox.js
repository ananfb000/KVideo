// ============================================================
// 咸鱼影视 - TVBox / 影视仓 JS 规则
// 原站：https://www.jxw888.cn/
// 实测跳转后域名：https://www.xianyu8.my/
// 实测时间：2026-11-09 晚，实时点击验证
//
// 已实测确认的 URL 规律（不要改）:
//   首页:            https://www.xianyu8.my/
//   分类列表:        /list/{分类id}.html          第1页
//                    /list/{分类id}-{页码}.html   第2页起
//                    例：连续剧 /list/2.html, /list/2-2.html
//                    短剧 /list/46-1.html
//   搜索:            /?wd={URL编码的关键词}
//                    例：/?wd=%E5%85%B0%E9%A6%99%E5%A6%82%E6%95%85
//   详情页:          /detail/{id}.html
//                    例：/detail/60157040.html（兰香如故，全47集）
//   播放页:          /detail/{id}-{集数}-0.html
//                    例：第1集 /detail/60157040-1-0.html
//                    第47集 /detail/60157040-47-0.html
//   分类id:
//     1 电影片 / 2 连续剧 / 3 综艺片 / 4 动漫片
//     35 电影解说 / 36 体育 / 46 短剧剧场 / kids.php 儿童专区
//
// 未确认 / 需注意：
//   1. 可见范围内没有 /api/、/vod/ 接口，也没有直接的 .m3u8 / .mp4 / iframe 地址。
//      换线路是页内 JS 切换，URL 不变。所以本规则用 play_parse:true，
//      让 TVBox 用自带解析 / 嗅探去处理播放页，不直接返回视频直链。
//   2. 下面一级 / 二级 / 搜索的解析用通用选择器 + 正则兜底写成，
//      因为实测只拿到了 URL 结构，没拿到页面源码的 class 名。
//      在 TVBox 里导入后先测分类、搜索、详情三步，
//      如果列表为空，多半是选择器要按实际 DOM 再调，不用改 URL 部分。
//
// TVBox 导入方法（JSON 配置里加一条，type 3）：
//   {
//     "key": "xianyu",
//     "name": "咸鱼影视",
//     "type": 3,
//     "api": "https://你自己托管的地址/jxw888-tvbox.js",
//     "searchable": 1,
//     "quickSearch": 1,
//     "filterable": 0
//   }
//   也可以把本文件放进 TVBox 本地 js 目录后用本地路径引用，
//   具体入口看你用的 TVBox / 影视仓版本。
// ============================================================

var rule = {
    title: '咸鱼影视',
    host: 'https://www.xianyu8.my',
    homeUrl: '/',
    // fyclass = 分类id, fypage = 页码
    // 第1页会变成 /list/1-1.html，实测 /list/2-1.html 这种带 -1 的形式站内也用（筛选链接就是这个形式）
    url: '/list/fyclass-fypage.html',
    searchUrl: '/?wd=**',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer': 'https://www.xianyu8.my/'
    },
    timeout: 5000,
    class_name: '电影&连续剧&综艺&动漫&电影解说&体育&短剧',
    class_url: '1&2&3&4&35&36&46',
    play_parse: true,
    lazy: `js:
        // 播放页本身就是 /detail/{id}-{集}-0.html，交回给 TVBox 解析
        input;
    `,
    limit: 6,
    double: true,

    // 首页推荐：取首页的 /detail/ 链接，去重
    推荐: `js:
        let html = request(rule.homeUrl);
        let list = pdfa(html, 'a[href*="/detail/"]');
        let seen = {};
        let d = [];
        list.forEach(function(a) {
            let href = pdfh(a, 'a&&href') || '';
            let m = href.match(/\\/detail\\/(\\d+)\\.html/);
            if (!m || seen[m[1]]) return;
            seen[m[1]] = 1;
            let name = pdfh(a, 'a&&title') || pdfh(a, 'a&&Text') || '';
            let pic = pdfh(a, 'img&&data-original') || pdfh(a, 'img&&src') || '';
            if (name) d.push({vod_id: href, vod_name: name.trim(), vod_pic: pic, vod_remarks: ''});
        });
        setResult(d);
    `,

    // 分类列表（一级）
    一级: `js:
        let html = request(input);
        let list = pdfa(html, 'a[href*="/detail/"]');
        let seen = {};
        let d = [];
        list.forEach(function(a) {
            let href = pdfh(a, 'a&&href') || '';
            let m = href.match(/\\/detail\\/(\\d+)\\.html/);
            if (!m || seen[m[1]]) return;
            seen[m[1]] = 1;
            let name = pdfh(a, 'a&&title') || pdfh(a, 'a&&Text') || '';
            let pic = pdfh(a, 'img&&data-original') || pdfh(a, 'img&&src') || '';
            // 备注：状态 / 集数常在链接附近的文本里，这里先取链接文本里的后半段做兜底
            let remarks = '';
            if (name) d.push({vod_id: href, vod_name: name.trim(), vod_pic: pic, vod_remarks: remarks});
        });
        setResult(d);
    `,

    // 详情页（二级）
    二级: `js:
        let html = request(input);
        let idMatch = input.match(/\\/detail\\/(\\d+)/);
        let vid = idMatch ? idMatch[1] : '';
        let title = pdfh(html, 'title&&Text') || '';
        title = title.replace(/_咸鱼影视.*$/, '').replace(/咸鱼影视.*$/, '').trim();
        let pic = pdfh(html, 'meta[property="og:image"]&&content') || '';
        let desc = '';
        try { desc = pdfh(html, 'meta[name="description"]&&content') || ''; } catch (e) {}
        // 剧集：/detail/{id}-{集}-0.html
        let eps = [];
        let re = new RegExp('/detail/' + vid + '-(\\\\d+)-0\\\\.html', 'g');
        let mm, epSeen = {};
        while ((mm = re.exec(html)) !== null) {
            if (!epSeen[mm[1]]) { epSeen[mm[1]] = 1; eps.push(mm[1]); }
        }
        eps.sort(function(a, b) { return parseInt(a) - parseInt(b); });
        let playUrl = [];
        eps.forEach(function(n) {
            playUrl.push('第' + n + '集$/detail/' + vid + '-' + n + '-0.html');
        });
        // 线路：站内实测有 12 个来源，换源是页内 JS 切换，TVBox 里只保留一个“默认线路”入口
        let vod = {
            vod_id: input,
            vod_name: title,
            vod_pic: pic,
            vod_content: desc,
            vod_play_from: '默认线路',
            vod_play_url: playUrl.join('#')
        };
        setResult(vod);
    `,

    // 搜索：/?wd=关键词，和一级一样解析 /detail/ 链接
    搜索: `js:
        let html = request(input);
        let list = pdfa(html, 'a[href*="/detail/"]');
        let seen = {};
        let d = [];
        list.forEach(function(a) {
            let href = pdfh(a, 'a&&href') || '';
            let m = href.match(/\\/detail\\/(\\d+)\\.html/);
            if (!m || seen[m[1]]) return;
            seen[m[1]] = 1;
            let name = pdfh(a, 'a&&title') || pdfh(a, 'a&&Text') || '';
            let pic = pdfh(a, 'img&&data-original') || pdfh(a, 'img&&src') || '';
            if (name) d.push({vod_id: href, vod_name: name.trim(), vod_pic: pic, vod_remarks: ''});
        });
        setResult(d);
    `
};
