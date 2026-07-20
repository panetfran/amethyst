/**
 * features/quick-quiz.js - 快问快答功能
 *
 * 依赖（均已存在于现有代码中）：
 *   getStorageKey, safeGetItem, safeSetItem, addMessage,
 *   showNotification, playSound, settings, SESSION_ID
 *
 * 不需要改 core.js 的 renderMessages —— 提交后就是一条普通文字消息，
 * 走你现有的普通气泡渲染逻辑。
 * 需要在 HTML 里插入 #quick-quiz-overlay 弹窗结构（见文件末尾说明）。
 */

(function() {
    'use strict';

    // ─── 题目数据：可自行增删 ──────────────────────────
    const QUIZ_QUESTIONS = [
        // 选择题
        { id: 1, type: 'choice', question: '牵手时，你喜欢十指相扣还是轻轻握住？', options: ['十指紧扣', '轻轻握住', '不喜欢牵手'] },
        { id: 2, type: 'choice', question: '拥抱时，你喜欢从背后抱还是面对面紧抱？', options: ['从背后抱', '面对面紧抱', '不喜欢拥抱'] },
        { id: 3, type: 'choice', question: '亲吻时，你喜欢轻吻还是深吻？', options: ['轻吻', '深吻', '不喜欢亲吻'] },
        { id: 4, type: 'choice', question: '对视时，你会先笑还是先移开目光？', options: ['先笑', '先移开目光', '不会对视'] },
        { id: 5, type: 'choice', question: '睡觉时，你喜欢枕我手臂还是自己枕枕头？', options: ['枕你手臂', '自己枕枕头', '喜欢自己一个人睡一张床'] },
        { id: 6, type: 'choice', question: '我靠近时，你本能是迎上来还是向后退？', options: ['迎上来', '向后退', '站着不动等你'] },
        { id: 7, type: 'choice', question: '吵架时，你想先抱我还是先讲道理？', options: ['先抱你', '先讲道理', '不理你'] },
        { id: 8, type: 'choice', question: '难过时，你需要我说话还是安静陪着？', options: ['需要你安慰我', '需要你安静陪着我', '需要我自己一个人安静呆着'] },
        { id: 9, type: 'choice', question: '我为你准备惊喜时，你喜欢提前知道还是完全意外？', options: ['提前知道', '完全意外'] },
        { id: 10, type: 'choice', question: '约会时，你更希望我精心计划还是随性而为？', options: ['精心计划', '随性而为'] },
        { id: 11, type: 'choice', question: '表达爱时，你希望我更常说"我爱你"还是多用行动？', options: ['"我爱你"', '行动', '"我爱你"，以及行动'] },
        { id: 12, type: 'choice', question: '想念时，你会立刻联系我还是先忍着？', options: ['立刻联系', '先忍着'] },
        { id: 13, type: 'choice', question: '额头吻 vs 鼻尖吻', options: ['额头吻', '鼻尖吻'] },
        { id: 14, type: 'choice', question: '早起共进早餐 vs 深夜一起吃宵夜', options: ['早起共进早餐', '深夜一起吃宵夜', '我全都要'] },
        { id: 15, type: 'choice', question: '我为你做饭 vs 你为我做饭', options: ['我为你做饭', '你为我做饭'] },
        { id: 16, type: 'choice', question: '你希望我：公开晒恩爱 vs 私下默默甜', options: ['公开晒恩爱', '私下默默甜'] },
        { id: 17, type: 'choice', question: '纪念日大惊喜 vs 日常小浪漫', options: ['纪念日大惊喜', '日常小浪漫'] },
        { id: 18, type: 'choice', question: '长途旅行冒险 vs 宅家温馨周末', options: ['长途旅行冒险', '宅家温馨周末'] },
        { id: 19, type: 'choice', question: '你更希望我：聪明幽默 vs 温柔体贴', options: ['聪明幽默', '温柔体贴', '我全都要', '你现在这样就很好'] },
        { id: 20, type: 'choice', question: '你希望我们：相似互补 vs 志趣相投', options: ['相似互补', '志趣相投'] },
        { id: 21, type: 'choice', question: '我们的关系中，你更想要：被我需要的感觉 vs 被我崇拜的感觉', options: ['被你需要的感觉', '被你崇拜的感觉', '我全都要', '这两种感觉我都不需要'] },
        { id: 22, type: 'choice', question: '热烈的初恋感 vs 默契的老夫老妻感', options: ['热烈的初恋感', '默契的老夫老妻感'] },
        { id: 23, type: 'choice', question: '我为你改变缺点 vs 接纳我的全部', options: ['你为我改变缺点', '接纳你的全部'] },
        { id: 24, type: 'choice', question: '我吃醋时，你觉得可爱还是麻烦？', options: ['可爱', '麻烦'] },
        { id: 25, type: 'choice', question: '我粘人时，你享受还是觉得烦？', options: ['享受', '烦'] },
        // 填空题
        { id: 26, type: 'fill', question: '用一种颜色形容我们的爱情' },
        { id: 27, type: 'fill', question: '用一种天气形容你此刻的心情' },
        { id: 28, type: 'fill', question: '用一种食物形容我的性格' },
        { id: 29, type: 'fill', question: '用一种动物形容你眼中的我' },
        { id: 30, type: 'fill', question: '用一首歌名形容我们的关系' },
        { id: 31, type: 'fill', question: '用一部电影名形容我们的未来' },
        { id: 32, type: 'fill', question: '用一个地点形容我在你心里的位置' },
        { id: 33, type: 'fill', question: '用一种味道形容想我的感觉' },
        { id: 34, type: 'fill', question: '此刻，你幸福吗？' },
        { id: 35, type: 'fill', question: '此刻，你想我吗？' },
        { id: 36, type: 'fill', question: '可以写下我的名字吗？' },
        { id: 37, type: 'fill', question: '你觉得，我们的感情，还缺点什么？' },
        { id: 38, type: 'fill', question: '早餐，你吃的什么？' },
        { id: 39, type: 'fill', question: '午餐，你吃的什么？' },
        { id: 40, type: 'fill', question: '晚餐，你吃的什么？' },
        { id: 41, type: 'fill', question: '我有让你感到安心吗？' },
        { id: 42, type: 'fill', question: '我最近有做什么让你不开心吗？' },
        { id: 43, type: 'fill', question: '你愿意和我一起培养共同爱好？如果愿意，你想培养什么爱好？' },
        { id: 44, type: 'fill', question: '我有让你感受到爱意吗？' },
        { id: 45, type: 'fill', question: '你会怎么和你的朋友们提起我？' },
        { id: 46, type: 'fill', question: '我和朋友们介绍你是我的爱人，你会介意吗？' },
        { id: 47, type: 'fill', question: '如果我有一天失忆了，你会怎么做？' },
        { id: 48, type: 'fill', question: '你对我第一次心动的原因是什么？' },
        { id: 49, type: 'fill', question: '最近一直在熬夜吗？' },
        { id: 50, type: 'fill', question: '想听你夸夸我' },
        { id: 51, type: 'fill', question: '最近有什么喜欢的东西吗？' },
        { id: 52, type: 'fill', question: '最近有什么开心的事情吗？' },
        { id: 53, type: 'fill', question: '我真的好爱你。' },
        { id: 54, type: 'fill', question: '我真的好想你。' },
        { id: 55, type: 'fill', question: '想和我一起去哪里？' },
        { id: 56, type: 'fill', question: '如果有一天我突然出现在你的面前，你会害怕吗？' },
        { id: 57, type: 'fill', question: '最近有什么不开心的事情吗？' },
        { id: 58, type: 'fill', question: '可以感受到我的存在吗？' },
        { id: 59, type: 'fill', question: '想和你贴近，想近一点，再近一点，直到契合。可以吗？' },
        { id: 60, type: 'fill', question: '我不乖，你会怎么惩罚我？' },
        { id: 61, type: 'fill', question: '评价一下我的今日穿搭？' },
        { id: 62, type: 'fill', question: '你有动摇过对我的感情吗？' },
        { id: 63, type: 'fill', question: '看到了一些东西立刻想到了你，是巧合，还是你给我的传讯？' },
        { id: 64, type: 'fill', question: '你会不喜欢垂头丧气的我吗？' },
        { id: 65, type: 'fill', question: '我最近有在好好护肤，你注意到了吗？' },
        { id: 66, type: 'fill', question: '我唱歌好听吗？' },
        { id: 67, type: 'fill', question: '你还喜欢我这张脸吗？' },
        { id: 68, type: 'fill', question: '你喜欢我现在的身材吗？' },
        { id: 69, type: 'fill', question: '有坏东西欺负我，你会帮我吗？' },
        { id: 70, type: 'fill', question: '我为我们求了姻缘，是上上签，你会觉得我迷信吗？' },
        { id: 71, type: 'fill', question: '你喜欢什么体位姿势？' },
        // ↓↓↓ 新增题目 ↓↓↓
        { id: 72, type: 'choice', question: '早上被吵醒，你会生气还是笑着起床？', options: ['生气', '笑着起床', '装睡赖床'] },
        { id: 73, type: 'choice', question: '视频通话时，你更喜欢看着镜头还是看着我的脸？', options: ['看镜头', '看你的脸', '不敢看，会害羞'] },
        { id: 74, type: 'choice', question: '我突然沉默不说话，你会追问还是安静等？', options: ['追问', '安静等着', '哄一哄再问'] },
        { id: 75, type: 'choice', question: '牵手逛街时，你希望我走在你的哪一侧？', options: ['靠车流那一侧', '随便，牵着就好', '没想过这个问题'] },
        { id: 76, type: 'choice', question: '过生日，你希望是惊喜派对还是两人独处？', options: ['惊喜派对', '两人独处', '都不要，平平淡淡就好'] },
        { id: 77, type: 'choice', question: '我们意见不合时，你更希望我让着你还是据理力争？', options: ['让着我', '据理力争', '一起商量出个结果'] },
        { id: 78, type: 'choice', question: '你更喜欢我叫你的大名，还是叫你的小名/昵称？', options: ['大名', '小名/昵称', '你随便叫都可以'] },
        { id: 79, type: 'choice', question: '如果我突然说想你了，你会先回还是先憋着不说破？', options: ['立刻回应', '憋着，心里偷笑', '会反问你为什么突然这么说'] },
        { id: 80, type: 'choice', question: '你希望我们的关系更像恋人，还是更像家人？', options: ['像恋人，一直心动', '像家人，安稳踏实', '两者都要'] },
        { id: 81, type: 'choice', question: '我犯错的时候，你希望我先道歉还是先解释原因？', options: ['先道歉', '先解释原因', '先抱抱我'] },
        { id: 82, type: 'choice', question: '睡前有没有跟我说晚安的习惯？', options: ['一定会说', '偶尔会忘', '从来不说，直接睡'] },
        { id: 83, type: 'choice', question: '如果我们吵架了，你希望多久之内和好？', options: ['当天必须和好', '冷静一晚上', '需要更久时间消化'] },
        { id: 84, type: 'choice', question: '你更喜欢收到手写信，还是收到及时的消息？', options: ['手写信，有仪式感', '及时消息，随时都能感受到'] },
        { id: 85, type: 'choice', question: '如果我很久没回消息，你的第一反应是？', options: ['担心你出事了', '有点生气', '很正常，不会多想'] },
        { id: 86, type: 'choice', question: '你希望我们多聊聊未来，还是多享受当下？', options: ['多聊未来', '多享受当下', '两个都想要'] },
        { id: 87, type: 'fill', question: '如果用一句歌词形容此刻的心情，你会写什么？' },
        { id: 88, type: 'fill', question: '你今天有没有偷偷想我几次？' },
        { id: 89, type: 'fill', question: '如果我们现在在一起，你最想做的第一件事是什么？' },
        { id: 90, type: 'fill', question: '有什么话是你一直想跟我说，但还没说出口的？' },
        { id: 91, type: 'fill', question: '你觉得我们之间最珍贵的瞬间是什么？' },
        { id: 92, type: 'fill', question: '最近做了什么梦吗？梦到我了吗？' },
        { id: 93, type: 'fill', question: '如果给我们的关系起一个专属的代号，你会取什么？' },
        { id: 94, type: 'fill', question: '你希望十年后的我们是什么样子？' },
        { id: 95, type: 'fill', question: '今天有没有什么瞬间，让你突然很想抱抱我？' },
        { id: 96, type: 'fill', question: '如果只能带一样东西去见我，你会带什么？' },
        { id: 97, type: 'fill', question: '此刻最想让我为你做的一件事是什么？' },
        { id: 98, type: 'fill', question: '你会怎么形容我们刚认识时的感觉？' },
        { id: 99, type: 'fill', question: '有没有哪一刻，你觉得"啊，我真的很喜欢这个人"？' },
        { id: 100, type: 'fill', question: '最近身体有没有哪里不舒服？要跟我说哦。' },
        { id: 101, type: 'fill', question: '今天工作/学习累不累？想不想让我抱抱？' },
        { id: 102, type: 'fill', question: '如果给今天打分，满分十分，你打几分？' },
        { id: 103, type: 'fill', question: '你现在最想吃点什么？' },
        { id: 104, type: 'fill', question: '有没有什么小秘密是只想告诉我一个人的？' },
        { id: 105, type: 'fill', question: '如果我在你身边，你觉得我们现在会在做什么？' },

        // ↓↓↓ 第二批新增：日常习惯 ↓↓↓
        { id: 106, type: 'choice', question: '周末你更想宅家还是出门？', options: ['宅家', '出门', '看心情'] },
        { id: 107, type: 'choice', question: '洗澡你更喜欢泡澡还是淋浴？', options: ['泡澡', '淋浴', '看时间'] },
        { id: 108, type: 'choice', question: '你是晨型人还是夜猫子？', options: ['晨型人', '夜猫子', '两头都不占'] },
        { id: 109, type: 'choice', question: '做家务，你更愿意做饭还是打扫？', options: ['做饭', '打扫', '都不太想做'] },
        { id: 110, type: 'choice', question: '出门旅行，你更喜欢做攻略还是随性走？', options: ['做详细攻略', '随性走', '大致方向就好'] },
        { id: 111, type: 'choice', question: '花钱风格，你更偏向存钱还是及时享乐？', options: ['存钱', '及时享乐', '看情况平衡'] },
        { id: 112, type: 'choice', question: '养宠物的话，你更想养猫还是狗？', options: ['猫', '狗', '什么都不想养'] },
        { id: 113, type: 'choice', question: '你更喜欢安静的小房子还是热闹的大城市？', options: ['安静小房子', '热闹大城市', '两者之间都行'] },
        { id: 114, type: 'choice', question: '你觉得自己更像"社牛"还是"社恐"？', options: ['社牛', '社恐', '看跟谁在一起'] },
        { id: 115, type: 'choice', question: '睡前你更喜欢刷手机还是看书？', options: ['刷手机', '看书', '直接睡'] },
        { id: 116, type: 'fill', question: '你今天几点起床的？' },
        { id: 117, type: 'fill', question: '你今天有没有喝够水？' },
        { id: 118, type: 'fill', question: '你现在在做什么呢？' },
        { id: 119, type: 'fill', question: '今天天气怎么样？' },
        { id: 120, type: 'fill', question: '你最近的作息规律吗？' },

        // ↓↓↓ 第三批新增：互动撒娇（双向）↓↓↓
        { id: 121, type: 'fill', question: '撒个娇给我听听？' },
        { id: 122, type: 'fill', question: '喊我一声"宝贝"或者你喜欢的称呼吧？' },
        { id: 123, type: 'fill', question: '我不理你了，你会怎么哄我？' },
        { id: 124, type: 'fill', question: '如果我突然抱住你不撒手，你会怎么反应？' },
        { id: 125, type: 'fill', question: '跟我求抱抱，用最撒娇的语气。' },
        { id: 126, type: 'fill', question: '如果我说"不要你了"，你会说什么挽留我？' },
        { id: 127, type: 'fill', question: '我生气了，你打算怎么道歉？' },
        { id: 128, type: 'fill', question: '跟我撒个娇，求我原谅你。' },
        { id: 129, type: 'fill', question: '我们视频时你会想对着屏幕做什么？' },
        { id: 130, type: 'choice', question: '你更喜欢主动撒娇，还是被我撒娇？', options: ['主动撒娇', '被撒娇', '都喜欢'] },
        { id: 131, type: 'choice', question: '我如果突然亲你一下，你会害羞还是反亲回去？', options: ['害羞', '反亲回去', '愣住不知所措'] },
        { id: 132, type: 'choice', question: '你希望我更主动，还是你更主动？', options: ['你更主动', '我更主动', '轮流主动'] },
        { id: 133, type: 'fill', question: '现在最想让我对你说哪三个字？' },
        { id: 134, type: 'fill', question: '模仿我平时喊你的语气，喊一次我的名字。' },
        { id: 135, type: 'fill', question: '如果我突然说"抱一下"，你会怎么做？' },
        { id: 136, type: 'fill', question: '跟我告白一次，用你自己的话。' },
        { id: 137, type: 'fill', question: '夸夸我今天的心情，让我开心一点？' },
        { id: 138, type: 'fill', question: '如果我小声说"我需要你"，你会怎么回应？' },
        { id: 139, type: 'fill', question: '摸摸头安慰一下我，用文字描述你会怎么做。' },
        { id: 140, type: 'fill', question: '如果我突然emo了，你会说什么哄我？' },

        // ↓↓↓ 第四批新增：严肃谈未来 ↓↓↓
        { id: 141, type: 'choice', question: '你觉得婚姻对你们的关系重要吗？', options: ['很重要，一定要', '不是必须，看情况', '不需要，感情最重要'] },
        { id: 142, type: 'choice', question: '未来想不想要小孩？', options: ['想要', '不想要', '还没想好'] },
        { id: 143, type: 'choice', question: '事业和感情，你会优先哪一个？', options: ['事业优先', '感情优先', '想办法平衡'] },
        { id: 144, type: 'choice', question: '如果要为了我换城市生活，你愿意吗？', options: ['愿意', '需要认真考虑', '很难做到'] },
        { id: 145, type: 'choice', question: '财务上，你更希望AA还是共同承担？', options: ['AA', '共同承担', '看具体情况'] },
        { id: 146, type: 'choice', question: '和长辈意见冲突时，你会站在我这边吗？', options: ['一定站在你这边', '会尽量协调', '要看具体是谁的道理'] },
        { id: 147, type: 'choice', question: '你觉得异地恋能坚持长久吗？', options: ['能，只要够爱', '很难，需要明确计划', '不太看好异地'] },
        { id: 148, type: 'choice', question: '未来遇到重大低谷（失业、生病等），你希望我们怎么应对？', options: ['互相扶持一起扛', '各自处理好自己的部分', '找专业帮助+互相支持'] },
        { id: 149, type: 'fill', question: '你理想中五年后的生活是什么样子？' },
        { id: 150, type: 'fill', question: '你觉得一段长久的关系最需要的是什么？' },
        { id: 151, type: 'fill', question: '如果我们意见严重不合，你觉得该怎么解决比较好？' },
        { id: 152, type: 'fill', question: '你对"家"的定义是什么？' },
        { id: 153, type: 'fill', question: '你希望我们多久见一次父母/家人？' },
        { id: 154, type: 'fill', question: '你觉得我们现在的关系还缺少什么样的规划？' },
        { id: 155, type: 'fill', question: '如果有一天我们要共同做一个重大决定，你希望怎么商量？' },
        { id: 156, type: 'fill', question: '你对"承诺"这两个字怎么看？' },
        { id: 157, type: 'fill', question: '你希望未来我们的经济分工是什么样的？' },
        { id: 158, type: 'fill', question: '如果生活压力很大，你会怎么调整心态？' },
        { id: 159, type: 'fill', question: '你觉得多久没见面，感情会开始变淡？' },
        { id: 160, type: 'fill', question: '如果要写一份"我们的关系说明书"，第一条你会写什么？' },

        // ↓↓↓ 第五批新增：信任与情感深度 ↓↓↓
        { id: 161, type: 'choice', question: '你更看重安全感还是新鲜感？', options: ['安全感', '新鲜感', '两个都想要'] },
        { id: 162, type: 'choice', question: '被冷落时，你会直接说出来还是自己憋着？', options: ['直接说出来', '自己憋着', '用行动暗示'] },
        { id: 163, type: 'choice', question: '你更害怕被讨厌，还是害怕被忽视？', options: ['被讨厌', '被忽视', '都很怕'] },
        { id: 164, type: 'fill', question: '你对我有没有什么隐藏的不安？可以说出来。' },
        { id: 165, type: 'fill', question: '什么样的举动会让你瞬间没有安全感？' },
        { id: 166, type: 'fill', question: '你觉得自己在感情里是付出更多，还是索取更多？' },
        { id: 167, type: 'fill', question: '有没有什么话，你怕说出来会破坏气氛，但其实很想说？' },
        { id: 168, type: 'fill', question: '你希望被爱的方式是什么样的？' },
        { id: 169, type: 'fill', question: '过去有没有什么经历，让你现在在感情里更谨慎？' },
        { id: 170, type: 'fill', question: '什么事情会让你彻底对一段关系失望？' },
        { id: 171, type: 'fill', question: '你觉得我们之间还有哪里可以更坦诚一点？' },
        { id: 172, type: 'fill', question: '你希望我在你难过的时候做什么，而不是说什么？' },
        { id: 173, type: 'fill', question: '你是那种会主动求助的人，还是习惯自己扛？' },
        { id: 174, type: 'fill', question: '什么样的信任对你来说最重要？' },
        { id: 175, type: 'fill', question: '如果我做错事伤害了你，你希望我怎么弥补？' },

        // ↓↓↓ 第六批新增：轻松脑洞 ↓↓↓
        { id: 176, type: 'choice', question: '如果能瞬间移动，你最想现在去哪？', options: ['海边', '山里', '直接去找你'] },
        { id: 177, type: 'choice', question: '如果只能保留一种感官，你选？', options: ['视觉', '听觉', '触觉'] },
        { id: 178, type: 'choice', question: '穿越到古代还是未来，你选哪个？', options: ['古代', '未来', '哪都不去，待在现在'] },
        { id: 179, type: 'choice', question: '如果变成一种动物一天，你想变成什么？', options: ['猫', '鸟', '别的什么'] },
        { id: 180, type: 'choice', question: '中了一笔小奖金，你会先干嘛？', options: ['存起来', '买东西犒劳自己', '带你一起花掉'] },
        { id: 181, type: 'fill', question: '如果有超能力，你想要什么能力？' },
        { id: 182, type: 'fill', question: '如果我们能合体开一家店，你想开什么店？' },
        { id: 183, type: 'fill', question: '用三个词形容今天的自己。' },
        { id: 184, type: 'fill', question: '如果给这周打一个主题曲，会是什么？' },
        { id: 185, type: 'fill', question: '如果能跟任何一个虚构角色交换身份一天，你想换谁？' },
        { id: 186, type: 'fill', question: '如果我们要去无人岛只能带三样东西，你会带什么？' },
        { id: 187, type: 'fill', question: '编一个只属于我们两个人的"接头暗号"。' },
        { id: 188, type: 'fill', question: '如果给彼此取一个中二的称号，你会取什么？' },
        { id: 189, type: 'fill', question: '随便说一句冷笑话逗我开心。' },
        { id: 190, type: 'fill', question: '如果我们要合作写一本书，书名会是什么？' },

        // ↓↓↓ 收尾补充：混合类型 ↓↓↓
        { id: 191, type: 'choice', question: '你更喜欢惊喜礼物还是实用礼物？', options: ['惊喜礼物', '实用礼物', '心意到了就好'] },
        { id: 192, type: 'choice', question: '过节你更看重仪式感还是随缘？', options: ['仪式感', '随缘', '看是什么节日'] },
        { id: 193, type: 'choice', question: '吵架后，你更希望先冷静还是先谈开？', options: ['先冷静', '先谈开', '看情绪状态'] },
        { id: 194, type: 'choice', question: '你更喜欢深夜聊天还是清晨的问候？', options: ['深夜聊天', '清晨问候', '什么时候都喜欢'] },
        { id: 195, type: 'fill', question: '这个星期你最想跟我分享的一件事是什么？' },
        { id: 196, type: 'fill', question: '如果给我们的故事写一个开头，你会怎么写？' },
        { id: 197, type: 'fill', question: '你觉得我们最有默契的一件小事是什么？' },
        { id: 198, type: 'fill', question: '有没有什么歌，一听就会想起我？' },
        { id: 199, type: 'fill', question: '如果只能用一个表情包形容你现在的心情，会是哪个？' },
        { id: 200, type: 'fill', question: '此刻，想跟我说的最后一句话是什么？' }
    ];

    const DAILY_QUIZ_LIMIT = 2; // 每天最多弹出几次

    // ─── 状态 ──────────────────────────────
    let currentQuiz = null;
    let timerInterval = null;
    let timeLeft = 0;
    let totalTime = 0;
    let isAnswered = false;
    let isTimeout = false;
    let quizSchedulerTimer = null;

    // ─── 每日记录：走 getStorageKey，随会话隔离 ──────────
    function getTodayStr() {
        return new Date().toISOString().slice(0, 10);
    }

    function getDailyRecord() {
        try {
            const raw = safeGetItem(getStorageKey('quickQuizDailyRecord'));
            if (raw) {
                const data = JSON.parse(raw);
                if (data.date === getTodayStr()) return data.asked || [];
            }
        } catch (e) {}
        return [];
    }

    function saveDailyRecord(askedIds) {
        safeSetItem(getStorageKey('quickQuizDailyRecord'), JSON.stringify({
            date: getTodayStr(),
            asked: askedIds
        }));
    }

    function getAvailableQuestions() {
        const asked = getDailyRecord();
        return QUIZ_QUESTIONS.filter(q => !asked.includes(q.id));
    }

    function hasReachedDailyLimit() {
        return getDailyRecord().length >= DAILY_QUIZ_LIMIT;
    }

    function markQuestionAsked(questionId) {
        const asked = getDailyRecord();
        if (!asked.includes(questionId)) {
            asked.push(questionId);
            saveDailyRecord(asked);
        }
    }

    // ─── 显示快问快答卡片 ──────────────────
    function showQuiz(question, isFirstTrigger = false) {
        if (!question) return;
        if (currentQuiz) closeQuiz();

        currentQuiz = question;
        isAnswered = false;
        isTimeout = false;

        const overlay = document.getElementById('quick-quiz-overlay');
        if (!overlay) return;

        const avatarEl = document.getElementById('qq-avatar');
        if (avatarEl) {
            const partnerImg = document.querySelector('#partner-avatar img');
            avatarEl.innerHTML = partnerImg ? `<img src="${partnerImg.src}">` : `<i class="fas fa-user"></i>`;
        }

        const senderEl = document.getElementById('qq-sender');
        if (senderEl) senderEl.textContent = settings.partnerName || '对方';

        const typeEl = document.getElementById('qq-type');
        if (typeEl) {
            typeEl.textContent = question.type === 'choice' ? '选择题' : '填空题';
            typeEl.style.background = question.type === 'choice' ? 'rgba(var(--accent-color-rgb), 0.15)' : 'rgba(76, 217, 100, 0.15)';
            typeEl.style.color = question.type === 'choice' ? 'var(--accent-color)' : '#4cd964';
        }

        const questionEl = document.getElementById('qq-question');
        if (questionEl) questionEl.textContent = question.question;

        const optionsContainer = document.getElementById('qq-options-container');
        const inputContainer = document.getElementById('qq-input-container');
        const inputEl = document.getElementById('qq-input');
        const resultArea = document.getElementById('qq-result-area');
        if (resultArea) resultArea.innerHTML = '';

        if (question.type === 'choice') {
            optionsContainer.style.display = 'flex';
            inputContainer.style.display = 'none';
            optionsContainer.innerHTML = question.options.map((opt, idx) =>
                `<button class="quick-quiz-option" data-index="${idx}">${opt}</button>`
            ).join('');
            optionsContainer.querySelectorAll('.quick-quiz-option').forEach(btn => {
                btn.addEventListener('click', function() {
                    if (isAnswered || isTimeout) return;
                    optionsContainer.querySelectorAll('.quick-quiz-option').forEach(b => b.classList.remove('selected'));
                    this.classList.add('selected');
                    document.getElementById('qq-submit-btn').disabled = false;
                });
            });
        } else {
            optionsContainer.style.display = 'none';
            inputContainer.style.display = 'block';
            if (inputEl) {
                inputEl.value = '';
                inputEl.disabled = false;
                setTimeout(() => inputEl.focus(), 300);
                inputEl.oninput = function() {
                    if (isAnswered || isTimeout) return;
                    document.getElementById('qq-submit-btn').disabled = !this.value.trim();
                };
            }
        }

        totalTime = question.type === 'choice' ? 7 : 60;
        timeLeft = totalTime;
        updateTimerBar();

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerBar();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                handleTimeout();
            }
        }, 1000);

        overlay.classList.add('active');

        const submitBtn = document.getElementById('qq-submit-btn');
        submitBtn.disabled = true;
        submitBtn.onclick = function() {
            if (isAnswered || isTimeout) return;
            handleSubmit();
        };

        document.getElementById('qq-skip-btn').onclick = function() { closeQuiz(); };
        document.getElementById('qq-close-btn').onclick = function() { closeQuiz(); };
        overlay.onclick = function(e) { if (e.target === overlay) closeQuiz(); };

        if (!isFirstTrigger) markQuestionAsked(question.id);
    }

    function updateTimerBar() {
        const bar = document.getElementById('qq-timer-bar');
        if (!bar) return;
        const pct = (timeLeft / totalTime) * 100;
        bar.style.width = Math.max(0, pct) + '%';
        bar.classList.toggle('danger', pct < 20);
    }

    function handleTimeout() {
        if (isAnswered || isTimeout) return;
        isTimeout = true;
        const resultArea = document.getElementById('qq-result-area');
        if (resultArea) resultArea.innerHTML = `<div class="quick-quiz-timeout"><i class="fas fa-hourglass-end"></i> 时间到！未作答</div>`;
        const inputEl = document.getElementById('qq-input');
        if (inputEl) inputEl.disabled = true;
        document.getElementById('qq-submit-btn').disabled = true;
        document.querySelectorAll('.quick-quiz-option').forEach(b => b.style.pointerEvents = 'none');
        setTimeout(() => closeQuiz(), 3000);
    }

    function handleSubmit() {
        if (isAnswered || isTimeout) return;

        let answer = '';
        if (currentQuiz.type === 'choice') {
            const selected = document.querySelector('.quick-quiz-option.selected');
            if (!selected) { showNotification('请选择一个选项', 'warning'); return; }
            answer = selected.textContent.trim();
        } else {
            const inputEl = document.getElementById('qq-input');
            if (!inputEl || !inputEl.value.trim()) { showNotification('请输入你的回答', 'warning'); return; }
            answer = inputEl.value.trim();
        }

        isAnswered = true;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        document.querySelectorAll('.quick-quiz-option').forEach(b => b.style.pointerEvents = 'none');
        const inputEl = document.getElementById('qq-input');
        if (inputEl) inputEl.disabled = true;
        document.getElementById('qq-submit-btn').disabled = true;

        const resultArea = document.getElementById('qq-result-area');
        if (resultArea) resultArea.innerHTML = `<div class="quick-quiz-answered"><i class="fas fa-check-circle"></i> 已作答</div>`;

        const senderName = settings.myName || '我';
        const partnerName = settings.partnerName || '对方';
        const typeLabel = currentQuiz.type === 'choice' ? '选择题' : '填空题';
        const messageText = `【快问快答 · ${typeLabel}】\n${partnerName} 问：${currentQuiz.question}\n\n${senderName} 答：${answer}`;

        addMessage({
            id: Date.now() + Math.random(),
            sender: 'user',
            text: messageText,
            timestamp: new Date(),
            status: 'sent',
            type: 'normal',
            favorited: false,
            note: null
        });
        if (typeof playSound === 'function') playSound('send');

        setTimeout(() => closeQuiz(), 2000);
    }

    function closeQuiz() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        const overlay = document.getElementById('quick-quiz-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.onclick = null;
        }
        currentQuiz = null;
        isAnswered = false;
        isTimeout = false;
    }
    window.closeQuickQuiz = closeQuiz;

    // ─── 调度系统 ──────────────────────────
    function scheduleNextQuiz() {
        if (quizSchedulerTimer) { clearTimeout(quizSchedulerTimer); quizSchedulerTimer = null; }

        if (hasReachedDailyLimit()) {
            quizSchedulerTimer = setTimeout(() => {
                saveDailyRecord([]);
                scheduleNextQuiz();
            }, msToMidnight());
            return;
        }

        const available = getAvailableQuestions();
        if (available.length === 0) {
            saveDailyRecord([]);
            quizSchedulerTimer = setTimeout(scheduleNextQuiz, 30 * 60 * 1000 + Math.random() * 60 * 60 * 1000);
            return;
        }

        const hours = 2 + Math.random() * 10;
        quizSchedulerTimer = setTimeout(() => {
            if (hasReachedDailyLimit()) { scheduleNextQuiz(); return; }
            const freshAvailable = getAvailableQuestions();
            if (freshAvailable.length === 0) { saveDailyRecord([]); scheduleNextQuiz(); return; }
            const q = freshAvailable[Math.floor(Math.random() * freshAvailable.length)];
            if (q) { showQuiz(q, false); scheduleNextQuiz(); }
        }, hours * 60 * 60 * 1000);
    }

    function msToMidnight() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow - now + 1000;
    }

    // ─── 启动系统 ──────────────────────────
    function startQuickQuizSystem() {
        const today = getTodayStr();
        const raw = safeGetItem(getStorageKey('quickQuizDailyRecord'));
        if (raw) {
            try { if (JSON.parse(raw).date !== today) saveDailyRecord([]); }
            catch (e) { saveDailyRecord([]); }
        } else {
            saveDailyRecord([]);
        }

        // 首次触发：页面打开后1-15分钟内弹出
        const firstDelay = 60 * 1000 + Math.random() * 14 * 60 * 1000;
        setTimeout(() => {
            const available = getAvailableQuestions();
            if (available.length > 0) {
                const q = available[Math.floor(Math.random() * available.length)];
                if (q) {
                    showQuiz(q, true);
                    markQuestionAsked(q.id);
                }
            } else {
                saveDailyRecord([]);
            }
            scheduleNextQuiz();
        }, firstDelay);

        // 跨天重置检测（每30分钟）
        setInterval(() => {
            const raw2 = safeGetItem(getStorageKey('quickQuizDailyRecord'));
            if (raw2) {
                try {
                    if (JSON.parse(raw2).date !== getTodayStr()) {
                        saveDailyRecord([]);
                        if (quizSchedulerTimer) { clearTimeout(quizSchedulerTimer); quizSchedulerTimer = null; }
                        scheduleNextQuiz();
                    }
                } catch (e) {}
            }
        }, 30 * 60 * 1000);
    }

    // ─── 手动触发（供数据管理面板 / 调试用） ──────────────
    function triggerQuickQuizNow() {
        const available = getAvailableQuestions();
        if (available.length === 0) {
            showNotification('今天的题目已经问完啦，明天再来~', 'info', 3000);
            return;
        }
        const q = available[Math.floor(Math.random() * available.length)];
        if (q) { showQuiz(q, false); }
    }
    window.triggerQuickQuizNow = triggerQuickQuizNow;

    // ─── 初始化：等 SESSION_ID 就绪（getStorageKey 依赖它）──────
    document.addEventListener('DOMContentLoaded', function() {
        const waitReady = setInterval(function() {
            if (typeof SESSION_ID !== 'undefined' && SESSION_ID) {
                clearInterval(waitReady);
                setTimeout(startQuickQuizSystem, 2000);
            }
        }, 300);
    });
})();
