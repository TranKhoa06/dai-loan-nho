const line = (han, pinyin, vi) => ({ han, pinyin, vi });

/** Authored practice scripts. These are guided exercises, not AI-generated replies. */
export const scenarios = [
  {
    id: 'hello', title: 'Làm quen', description: 'Chào hỏi, giới thiệu tên và quê quán.',
    opener: line('你好！很高興認識你。', 'Nǐ hǎo! Hěn gāoxìng rènshì nǐ.', 'Chào bạn! Rất vui được làm quen.'),
    turns: [
      { prompt: line('你叫什麼名字？', 'Nǐ jiào shénme míngzi?', 'Bạn tên là gì?'), suggestions: [line('我叫小安。', 'Wǒ jiào Xiǎo Ān.', 'Tôi tên Tiểu An.'), line('我叫阿明。', 'Wǒ jiào Ā Míng.', 'Tôi tên A Minh.')], reply: line('很高興認識你！', 'Hěn gāoxìng rènshì nǐ!', 'Rất vui được làm quen với bạn!') },
      { prompt: line('你是哪裡人？', 'Nǐ shì nǎlǐ rén?', 'Bạn là người ở đâu?'), suggestions: [line('我是越南人。', 'Wǒ shì Yuènán rén.', 'Tôi là người Việt Nam.'), line('我是臺灣人。', 'Wǒ shì Táiwān rén.', 'Tôi là người Đài Loan.')], reply: line('歡迎你！我們一起練習中文吧。', 'Huānyíng nǐ! Wǒmen yīqǐ liànxí Zhōngwén ba.', 'Chào mừng bạn! Chúng ta cùng luyện tiếng Hoa nhé.') },
      { prompt: line('你學中文多久了？', 'Nǐ xué Zhōngwén duō jiǔ le?', 'Bạn học tiếng Hoa bao lâu rồi?'), suggestions: [line('我剛開始學。', 'Wǒ gāng kāishǐ xué.', 'Tôi vừa bắt đầu học.'), line('我學中文三個月了。', 'Wǒ xué Zhōngwén sān ge yuè le.', 'Tôi học tiếng Hoa được ba tháng rồi.')], reply: line('每天練習一點，你會慢慢進步。', 'Měitiān liànxí yīdiǎn, nǐ huì mànmàn jìnbù.', 'Luyện một chút mỗi ngày, bạn sẽ dần tiến bộ.') },
    ],
  },
  {
    id: 'tea', title: 'Gọi trà sữa', description: 'Chọn đồ uống, lượng đường và đá.',
    opener: line('歡迎光臨！', 'Huānyíng guānglín!', 'Chào mừng quý khách!'),
    turns: [
      { prompt: line('請問你要喝什麼？', 'Qǐngwèn nǐ yào hē shénme?', 'Bạn muốn uống gì?'), suggestions: [line('我要一杯珍珠奶茶。', 'Wǒ yào yī bēi zhēnzhū nǎichá.', 'Tôi muốn một ly trà sữa trân châu.'), line('我要一杯紅茶。', 'Wǒ yào yī bēi hóngchá.', 'Tôi muốn một ly hồng trà.')], reply: line('好的。', 'Hǎo de.', 'Được ạ.') },
      { prompt: line('甜度和冰塊呢？', 'Tiándù hé bīngkuài ne?', 'Còn lượng đường và đá?'), suggestions: [line('半糖，少冰，謝謝。', 'Bàn táng, shǎo bīng, xièxie.', 'Nửa đường, ít đá, cảm ơn.'), line('無糖，去冰，謝謝。', 'Wú táng, qù bīng, xièxie.', 'Không đường, không đá, cảm ơn.')], reply: line('沒問題。', 'Méi wèntí.', 'Không vấn đề gì.') },
      { prompt: line('要內用還是外帶？', 'Yào nèiyòng háishi wàidài?', 'Dùng tại chỗ hay mang đi?'), suggestions: [line('外帶，謝謝。', 'Wàidài, xièxie.', 'Mang đi, cảm ơn.'), line('我要內用。', 'Wǒ yào nèiyòng.', 'Tôi dùng tại chỗ.')], reply: line('請稍等，謝謝。', 'Qǐng shāo děng, xièxie.', 'Vui lòng đợi một chút, cảm ơn.') },
    ],
  },
  {
    id: 'mrt', title: 'Đi tàu điện', description: 'Hỏi đường đến ga và mua thẻ đi lại.',
    opener: line('你好，需要幫忙嗎？', 'Nǐ hǎo, xūyào bāngmáng ma?', 'Chào bạn, bạn cần giúp gì không?'),
    turns: [
      { prompt: line('你要去哪裡？', 'Nǐ yào qù nǎlǐ?', 'Bạn muốn đi đâu?'), suggestions: [line('我要去臺北車站。', 'Wǒ yào qù Táiběi Chēzhàn.', 'Tôi muốn đi ga Đài Bắc.'), line('我要去西門站。', 'Wǒ yào qù Xīmén Zhàn.', 'Tôi muốn đi ga Tây Môn.')], reply: line('你可以搭捷運。', 'Nǐ kěyǐ dā jiéyùn.', 'Bạn có thể đi tàu điện MRT.') },
      { prompt: line('你有悠遊卡嗎？', 'Nǐ yǒu Yōuyóukǎ ma?', 'Bạn có thẻ EasyCard chưa?'), suggestions: [line('還沒有，哪裡可以買？', 'Hái méiyǒu, nǎlǐ kěyǐ mǎi?', 'Chưa có, tôi có thể mua ở đâu?'), line('有，我有悠遊卡。', 'Yǒu, wǒ yǒu Yōuyóukǎ.', 'Có, tôi có thẻ EasyCard.')], reply: line('捷運站或便利商店通常都可以買到。', 'Jiéyùn zhàn huò biànlì shāngdiàn tōngcháng dōu kěyǐ mǎi dào.', 'Thông thường có thể mua tại ga MRT hoặc cửa hàng tiện lợi.') },
      { prompt: line('還有其他問題嗎？', 'Hái yǒu qítā wèntí ma?', 'Bạn còn câu hỏi nào khác không?'), suggestions: [line('請問，捷運站在哪裡？', 'Qǐngwèn, jiéyùn zhàn zài nǎlǐ?', 'Xin hỏi ga MRT ở đâu?'), line('沒有了，謝謝你的幫忙。', 'Méiyǒu le, xièxie nǐ de bāngmáng.', 'Hết rồi, cảm ơn bạn đã giúp.')], reply: line('不客氣！出發前記得查看路線圖。', 'Bù kèqi! Chūfā qián jìde chákàn lùxiàn tú.', 'Không có gì! Nhớ xem sơ đồ tuyến trước khi đi.') },
    ],
  },
  {
    id: 'market', title: 'Mua sắm', description: 'Hỏi giá, số lượng và cách thanh toán.',
    opener: line('歡迎！慢慢看。', 'Huānyíng! Mànmàn kàn.', 'Chào mừng! Bạn cứ xem nhé.'),
    turns: [
      { prompt: line('你想買什麼？', 'Nǐ xiǎng mǎi shénme?', 'Bạn muốn mua gì?'), suggestions: [line('我想買這個。', 'Wǒ xiǎng mǎi zhège.', 'Tôi muốn mua cái này.'), line('請問，這個多少錢？', 'Qǐngwèn, zhège duōshǎo qián?', 'Xin hỏi cái này bao nhiêu tiền?')], reply: line('這個一百塊。', 'Zhège yī bǎi kuài.', 'Cái này một trăm Đài tệ (giá giả định để luyện tập).') },
      { prompt: line('你要幾個？', 'Nǐ yào jǐ ge?', 'Bạn muốn mấy cái?'), suggestions: [line('我要一個。', 'Wǒ yào yī ge.', 'Tôi muốn một cái.'), line('我要兩個。', 'Wǒ yào liǎng ge.', 'Tôi muốn hai cái.')], reply: line('好的，我幫你裝起來。', 'Hǎo de, wǒ bāng nǐ zhuāng qǐlái.', 'Được, tôi gói cho bạn.') },
      { prompt: line('你要怎麼付款？', 'Nǐ yào zěnme fùkuǎn?', 'Bạn muốn thanh toán thế nào?'), suggestions: [line('我付現金。', 'Wǒ fù xiànjīn.', 'Tôi trả tiền mặt.'), line('可以刷卡嗎？', 'Kěyǐ shuākǎ ma?', 'Có thể quẹt thẻ không?')], reply: line('這次練習可以用現金或信用卡。', 'Zhè cì liànxí kěyǐ yòng xiànjīn huò xìnyòngkǎ.', 'Trong bài luyện này có thể trả bằng tiền mặt hoặc thẻ tín dụng.') },
    ],
  },
  {
    id: 'restaurant', title: 'Ăn ở quán', description: 'Gọi món, nói yêu cầu ăn uống và tính tiền.',
    opener: line('歡迎光臨！請坐。', 'Huānyíng guānglín! Qǐng zuò.', 'Chào mừng quý khách! Mời ngồi.'),
    turns: [
      { prompt: line('請問幾位？', 'Qǐngwèn jǐ wèi?', 'Xin hỏi có mấy người?'), suggestions: [line('兩位，謝謝。', 'Liǎng wèi, xièxie.', 'Hai người, cảm ơn.'), line('一位，謝謝。', 'Yī wèi, xièxie.', 'Một người, cảm ơn.')], reply: line('這是菜單。', 'Zhè shì càidān.', 'Đây là thực đơn.') },
      { prompt: line('你想吃什麼？', 'Nǐ xiǎng chī shénme?', 'Bạn muốn ăn gì?'), suggestions: [line('我要一碗牛肉麵。', 'Wǒ yào yī wǎn niúròu miàn.', 'Tôi muốn một tô mì bò.'), line('我吃素，有素食嗎？', 'Wǒ chī sù, yǒu sùshí ma?', 'Tôi ăn chay, có món chay không?')], reply: line('好的，我確認一下。', 'Hǎo de, wǒ quèrèn yīxià.', 'Được, để tôi kiểm tra một chút.') },
      { prompt: line('吃完以後，你可以怎麼說？', 'Chī wán yǐhòu, nǐ kěyǐ zěnme shuō?', 'Sau khi ăn xong, bạn có thể nói thế nào?'), suggestions: [line('請幫我結帳。', 'Qǐng bāng wǒ jiézhàng.', 'Vui lòng tính tiền giúp tôi.'), line('請問，在哪裡結帳？', 'Qǐngwèn, zài nǎlǐ jiézhàng?', 'Xin hỏi tôi thanh toán ở đâu?')], reply: line('請到櫃檯結帳，謝謝。', 'Qǐng dào guìtái jiézhàng, xièxie.', 'Vui lòng thanh toán tại quầy, cảm ơn.') },
    ],
  },
  {
    id: 'weekend', title: 'Hẹn cuối tuần', description: 'Rủ bạn đi chơi, thống nhất thời gian và địa điểm.',
    opener: line('這個週末你有空嗎？', 'Zhège zhōumò nǐ yǒu kòng ma?', 'Cuối tuần này bạn rảnh không?'),
    turns: [
      { prompt: line('星期六要不要一起出去？', 'Xīngqíliù yào bu yào yīqǐ chūqù?', 'Thứ Bảy cùng ra ngoài nhé?'), suggestions: [line('好啊！你想去哪裡？', 'Hǎo a! Nǐ xiǎng qù nǎlǐ?', 'Được! Bạn muốn đi đâu?'), line('星期六我沒有空，星期日可以嗎？', 'Xīngqíliù wǒ méiyǒu kòng, xīngqírì kěyǐ ma?', 'Thứ Bảy tôi bận, Chủ nhật được không?')], reply: line('我們可以找一天去公園散步。', 'Wǒmen kěyǐ zhǎo yī tiān qù gōngyuán sànbù.', 'Chúng ta có thể chọn một ngày đi dạo công viên.') },
      { prompt: line('你幾點方便？', 'Nǐ jǐ diǎn fāngbiàn?', 'Bạn tiện lúc mấy giờ?'), suggestions: [line('下午兩點可以嗎？', 'Xiàwǔ liǎng diǎn kěyǐ ma?', 'Hai giờ chiều được không?'), line('早上九點怎麼樣？', 'Zǎoshang jiǔ diǎn zěnmeyàng?', 'Chín giờ sáng thì sao?')], reply: line('可以，我們就在你說的時間見。', 'Kěyǐ, wǒmen jiù zài nǐ shuō de shíjiān jiàn.', 'Được, chúng ta gặp lúc bạn vừa nói nhé.') },
      { prompt: line('在哪裡見面？', 'Zài nǎlǐ jiànmiàn?', 'Gặp nhau ở đâu?'), suggestions: [line('在公園門口見。', 'Zài gōngyuán ménkǒu jiàn.', 'Gặp ở cổng công viên.'), line('在捷運站出口見。', 'Zài jiéyùn zhàn chūkǒu jiàn.', 'Gặp ở lối ra ga MRT.')], reply: line('好，記得出門前確認地點。到時候見！', 'Hǎo, jìde chūmén qián quèrèn dìdiǎn. Dào shíhou jiàn!', 'Được, nhớ xác nhận địa điểm trước khi đi. Hẹn gặp bạn!') },
    ],
  },
];

export function validateEndpoint(endpoint) {
  let url;
  try { url = new URL(String(endpoint || '').trim()); } catch { throw new Error('Hãy nhập địa chỉ HTTPS của máy chủ trợ giảng, ví dụ https://ten-worker.workers.dev.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Máy chủ AI phải dùng HTTPS; HTTP chỉ được dùng trên localhost.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Địa chỉ AI không được chứa mật khẩu, tham số hoặc dấu #.');
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/chat';
  if (url.pathname !== '/chat') throw new Error('Địa chỉ máy chủ cần trỏ tới /chat hoặc tên miền gốc của Worker.');
  return url.toString();
}

export async function askAI({ endpoint, token = '', messages, scenario = '', signal } = {}) {
  const url = validateEndpoint(endpoint);
  if (!Array.isArray(messages) || !messages.length || messages.length > 20) throw new Error('Hội thoại cần từ 1 đến 20 tin nhắn. Hãy bắt đầu cuộc trò chuyện mới khi quá dài.');
  const cleanMessages = messages.map((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 2000) throw new Error('Mỗi tin nhắn cần có nội dung và không dài quá 2.000 ký tự.');
    return { role: message.role, content: message.content.trim() };
  });
  if (cleanMessages.at(-1).role !== 'user') throw new Error('Hãy gửi câu hỏi của bạn trước khi gọi trợ giảng.');
  if (typeof token !== 'string' || token.length > 512 || /[\r\n]/.test(token)) throw new Error('Mã truy cập máy chủ không hợp lệ.');
  const controller = new AbortController();
  const relayAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) relayAbort();
  signal?.addEventListener('abort', relayAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 35000);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
    const response = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ messages: cleanMessages, scenario: String(scenario).slice(0, 120) }),
      credentials: 'omit', cache: 'no-store', signal: controller.signal,
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Hãy kiểm tra địa chỉ /chat.'); }
    if (!response.ok) {
      const fallback = response.status === 429 ? 'Bạn gửi hơi nhanh hoặc dịch vụ đã hết hạn mức. Hãy thử lại sau.' : response.status === 401 ? 'Mã truy cập chưa đúng. Hãy kiểm tra Cài đặt AI.' : response.status === 403 ? 'Máy chủ chưa cho phép tên miền của web này.' : 'Máy chủ AI đang gặp lỗi. Hãy thử lại sau.';
      throw new Error(typeof data?.error === 'string' && data.error.length <= 400 ? data.error : fallback);
    }
    if (typeof data?.reply !== 'string' || !data.reply.trim() || data.reply.length > 12000) throw new Error('Máy chủ chưa trả về câu trả lời hợp lệ. Hãy thử lại.');
    return { reply: data.reply.trim() };
  } catch (error) {
    if (controller.signal.aborted) {
      if (signal?.aborted) throw new DOMException('Đã hủy yêu cầu AI.', 'AbortError');
      throw new Error('AI phản hồi quá lâu. Hãy thử lại sau.');
    }
    if (error instanceof TypeError) throw new Error('Không kết nối được máy chủ AI. Hãy kiểm tra mạng, địa chỉ máy chủ và cấu hình CORS.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', relayAbort);
  }
}
