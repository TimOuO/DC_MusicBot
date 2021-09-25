const { Client } = require('discord.js');
const ytdl = require('ytdl-core');
const { token } = require('./token.json');
const { prefix } = require('./config.json');
const client = new Client();

class Music {

    constructor() {
        /**
         * 下面的物件都是以 Discord guild id 當 key，例如：
         * this.isPlaying = {
         *     724145832802385970: false
         * }
         */

        /**
         * 機器人是否正在播放音樂
         * this.isPlaying = {
         *     724145832802385970: false
         * }
         */
        this.isPlaying = {};

        /**
         * 等待播放的音樂隊列，例如：
         * this.queue = {
         *     724145832802385970: [{
         *         name: 'G.E.M.鄧紫棋【好想好想你 Missing You】Official Music Video',
         *         url: 'https://www.youtube.com/watch?v=P6QXo88IG2c&ab_channel=GEM%E9%84%A7%E7%B4%AB%E6%A3%8B'
         *     }]
         * }
         */
        this.queue = {};

        // https://discord.js.org/#/docs/main/stable/class/VoiceConnection
        this.connection = {};

        // https://discord.js.org/#/docs/main/stable/class/StreamDispatcher
        this.dispatcher = {};
    }

    async join(msg) {

        // 如果使用者正在頻道中
        if (msg.member.voice.channel !== null) {
            // Bot 加入語音頻道
            this.connection[msg.guild.id] = await msg.member.voice.channel.join();
        } else {
            msg.channel.send('Please join the channel first 😉');
        }

    }

    async play(msg) {

        // 語音群的 ID
        const guildID = msg.guild.id;

        // 如果 Bot 還沒加入該語音群的語音頻道
        if (!this.connection[guildID]) {
            msg.channel.send('Please use `!join` to add me to the channel 😘');
            return;
        }

        // 如果 Bot leave 後又未加入語音頻道
        if (this.connection[guildID].status === 4) {
            msg.channel.send('Please use `!join` to rejoin the channel 😘');
            return;
        }

        // 處理字串，將 ! 字串拿掉，只留下 YouTube 網址
        const musicURL = msg.content.replace(`${prefix}p`, '').trim();

        try {

            // 取得 YouTube 影片資訊
            const res = await ytdl.getInfo(musicURL);
            const info = res.videoDetails;

            // 將歌曲資訊加入隊列
            if (!this.queue[guildID]) {
                this.queue[guildID] = [];
            }

            this.queue[guildID].push({
                name: info.title,
                url: musicURL
            });

            // 如果目前正在播放歌曲就加入隊列，反之則播放歌曲
            if (this.isPlaying[guildID]) {
                msg.channel.send(`🎵 Joined the song：${info.title}`);
            } else {
                this.isPlaying[guildID] = true;
                this.playMusic(msg, guildID, this.queue[guildID][0]);
            }

        } catch(e) {
            console.log(e);
        }
    }

    playMusic(msg, guildID, musicInfo) {

        // 提示播放音樂
        msg.channel.send(`🎶 Playing：${musicInfo.name}`);

        // 播放音樂
        this.dispatcher[guildID] = this.connection[guildID].play(ytdl(musicInfo.url, { filter: 'audioonly' }));

        // 把音量降 50%，不然第一次容易被機器人的音量嚇到 QQ
        this.dispatcher[guildID].setVolume(0.5);

        // 移除 queue 中目前播放的歌曲
        this.queue[guildID].shift();

        // 歌曲播放結束時的事件
        this.dispatcher[guildID].on('finish', () => {

            // 如果隊列中有歌曲
            if (this.queue[guildID].length > 0) {
                this.playMusic(msg, guildID, this.queue[guildID][0]);
            } else {
                this.isPlaying[guildID] = false;
                msg.channel.send('♫♪ No music, please add music 😆');
            }
        });
    }

    resume(msg) {

        if (this.dispatcher[msg.guild.id]) {
            msg.channel.send('恢復播放');

            // 恢復播放
            this.dispatcher[msg.guild.id].resume();
        }
    }

    pause(msg) {

        if (this.dispatcher[msg.guild.id]) {
            msg.channel.send('⏸ Paused');

            // 暫停播放
            this.dispatcher[msg.guild.id].pause();
        }
    }

    skip(msg) {

        if (this.dispatcher[msg.guild.id]) {
            msg.channel.send('⏩ Skipped 👍');

            // 跳過歌曲
            this.dispatcher[msg.guild.id].end();
        }
    }

    nowQueue(msg) {

        // 如果隊列中有歌曲就顯示
        if (this.queue[msg.guild.id] && this.queue[msg.guild.id].length > 0) {
            // 字串處理，將 Object 組成字串
            const queueString = this.queue[msg.guild.id].map((item, index) => `[${index+1}] ${item.name}\n`).join();
            msg.channel.send(queueString);
        } else {
            msg.channel.send('No songs in the queue 😣');
        }
    }

    leave(msg) {

        // 如果機器人在頻道中
        if (this.connection[msg.guild.id] && this.connection[msg.guild.id].status === 0) {

            // 如果機器人有播放過歌曲
            if (this.queue.hasOwnProperty(msg.guild.id)) {

                // 清空播放列表
                delete this.queue[msg.guild.id];

                // 改變 isPlaying 狀態為 false
                this.isPlaying[msg.guild.id] = false;
            }

            // 離開頻道
            this.connection[msg.guild.id].disconnect();
        } else {
            msg.channel.send(`I haven't joined any channels 😶`);
        }
    }
}

const music = new Music();

// 當 Bot 接收到訊息時的事件
client.on('message', async (msg) => {

    // 如果發送訊息的地方不是語音群（可能是私人），就 return
    if (!msg.guild) return;

    // !join
    if (msg.content === `${prefix}join`) {

        // 機器人加入語音頻道
        music.join(msg);
    }

    // 如果使用者輸入的內容中包含 !p
    if (msg.content.indexOf(`${prefix}p`) > -1) {

        // 如果使用者在語音頻道中
        if (msg.member.voice.channel) {

            // 播放音樂
            await music.play(msg);
        } else {

            // 如果使用者不在任何一個語音頻道
            msg.reply(`How do you listen if you don't join 😥`);
        }
    }

    // !resume
    if (msg.content === `${prefix}resume`) {

        // 恢復音樂
        music.resume(msg);
    }

    // !pause
    if (msg.content === `${prefix}pause`) {

        // 暫停音樂
        music.pause(msg);
    }

    // !skip
    if (msg.content === `${prefix}s`) {

        // 跳過音樂
        music.skip(msg);
    }

    // !queue
    if (msg.content === `${prefix}queue`) {

        // 查看隊列
        music.nowQueue(msg);
    }

    // !leave
    if (msg.content === `${prefix}leave`) {

        // 機器人離開頻道
        music.leave(msg);
    }
});


// 連上線時的事件
client.on('ready', () => {

    console.log(`Logged in as ${client.user.tag}!`);

});

// 當 Bot 接收到訊息時的事件
client.on('message', msg => {

    // 前置判斷
    try {
        // 判斷是否為私聊訊息
        if (!msg.guild || !msg.member) return;

        // 判斷上層是否存在
        if (!msg.member.user) return;
        
        // 判斷此訊息的使用者是不是機器人
        if (msg.member.user.bot) return;

    } catch(err) {
        return;
    };
    
    try {
         // 如果訊息的內容包含
        if (msg.content.indexOf(`跟你說喔`) > -1) {
            msg.channel.send('小胖胖很可愛🥰');
        }
        if (msg.content.indexOf(`哼`) > -1) {
            msg.channel.send('(把鼓起的臉頰戳下去😉');
        }
        if (msg.content.indexOf(`被你氣死`) > -1) {
            msg.channel.send('不氣不氣~ 小胖胖最好了');
        }
        if (msg.content.indexOf(`滾`) > -1) {
            msg.channel.send('滾地球一圈🌏🌍🌎🌏 我又回來了~');
        }
        if (msg.content.indexOf(`臭胖`) > -1) {
            msg.channel.send('是香胖歐😊');
        }
        if (msg.content.indexOf(`死胖子`) > -1) {
            msg.channel.send('你怎麼忍心🥺');
        }
        if (msg.content.indexOf(`胖胖`) > -1) {
            msg.channel.send('怎麼了小胖胖😀');
        }
        if (msg.content.indexOf(`掰`) > -1) {
            msg.channel.send('掰掰小胖胖👋');
        }
        if (msg.content.indexOf(`拜`) > -1) {
            msg.channel.send('掰掰小胖胖👋');
        }
        if (msg.content.indexOf(`喔`) > -1) {
            msg.channel.send('(搓臉');
        }
        if (msg.content.indexOf(`憨`) > -1) {
            msg.channel.send('肯定不是我呢😀');
        }
        if (msg.content.indexOf(`靠`) > -1) {
            msg.channel.send('Cow是牛喔~');
        }
        if (msg.content.indexOf(`蛤`) > -1) {
            msg.channel.send('蛤蚂在海裡喔，煮湯好喝😋');
        }
        if (msg.content.indexOf(`我好可愛`) > -1) {
            msg.channel.send('小胖胖最可愛了🥰');
        }
        if (msg.content.indexOf(`不理我`) > -1) {
            msg.channel.send('怎麼會不理你呢~小胖胖😉');
        }
        if (msg.content.indexOf(`不理你`) > -1) {
            msg.channel.send('不要不理我拉~小胖胖🥺');
        }
        if (msg.content.indexOf(`很痛`) > -1) {
            msg.channel.send('不痛不痛眼淚是珍珠🥺');
        }
        if (msg.content.indexOf(`晚上好`) > -1) {
            msg.channel.send('晚上好的呢~');
        }
        if (msg.content.indexOf(`～～`) > -1) {
            msg.channel.send('海帶呀海帶～海帶呀海帶～');
        }
        if (msg.content.indexOf(`~~`) > -1) {
            msg.channel.send('海帶呀海帶~海帶呀海帶~');
        }
        if (msg.content.indexOf(`廁所`) > -1) {
            msg.channel.send('小心不要掉到馬桶喔~😉');
        }
        if (msg.content.indexOf(`🌚`) > -1) {
            msg.channel.send('小胖胖太陽曬很多喔😏 要記得擦防曬~');
        }
        if (msg.content.indexOf(`嗚嗚`) > -1) {
            msg.channel.send('嗚~嗚~ 寢強寢強~');
        }
        if (msg.content.indexOf(`人渣`) > -1) {
            msg.channel.send('皮諾可，這個直接電死😡');
        }
        if (msg.content.indexOf(`變態`) > -1) {
            msg.channel.send('誰!? Who!? 蝦郎!? 😮');
        }
        if (msg.content.indexOf(`欠打`) > -1) {
            msg.channel.send('誰!? Who!? 蝦郎!? 😮 肯定不是我😉');
        }
        if (msg.content.indexOf(`關麥`) > -1) {
            msg.channel.send('沒有問題的呢~');
        }
        if (msg.content.indexOf(`去樓下`) > -1) {
            msg.channel.send('沒有問題的呢~');
        }
        if (msg.content.indexOf(`洗澡`) > -1) {
            msg.channel.send('要變香香小胖胖了😊');
        }
        if (msg.content.indexOf(`吃東西`) > -1) {
            msg.channel.send('小胖胖 看看你的肚肚😀');
        }
        if (msg.content.indexOf(`等一下`) > -1) {
            msg.channel.send('等兩下😉');
        }
        if (msg.content.indexOf(`等兩下`) > -1) {
            msg.channel.send('等三下😉');
        }
        if (msg.content.indexOf(`嘴邊肉`) > -1) {
            msg.reply('的特好捏呢😊');
        }
        if (msg.content === '胖子') {
            msg.reply('很瘦的呦~');
        }
        if (msg.content === '可愛') {
            msg.reply('誰可愛呀😏~');
        }

    }catch (err) {
        console.log('OnMessageError', err);
    }
});

client.login(token);