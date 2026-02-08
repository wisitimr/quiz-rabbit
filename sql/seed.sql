-- ============================================================
-- Quiz Rabbit - Seed Data
-- ============================================================
-- ธีม, ตัวละคร, แคมเปญ, checkpoint tokens, 20 คำถาม (4 ต่อจุด)
-- ============================================================

-- 1) สร้างธีม "Pastel Bunny"
INSERT INTO quiz_themes (id, name, config) VALUES
(1, 'Pastel Bunny', '{
    "primaryColor": "#FF6B9D",
    "backgroundColor": "#FFF5E4",
    "cardColor": "#FFFFFF",
    "buttonColor": "#FF6B9D",
    "buttonTextColor": "#FFFFFF",
    "buttonRadius": "12px",
    "correctColor": "#2ECC71",
    "wrongColor": "#E74C3C",
    "fontFamily": "\"Noto Sans Thai\", \"Sarabun\", sans-serif",
    "titleFontSize": "1.5rem",
    "questionFontSize": "1.1rem",
    "progressBarColor": "#FF6B9D",
    "shadowColor": "rgba(255, 107, 157, 0.2)"
}'::jsonb);

-- 2) สร้างตัวละคร — 5 ตัว scene (ต่อจุดเช็คพอยต์)
INSERT INTO quiz_characters (id, name, asset_idle, asset_correct, asset_wrong, metadata) VALUES
(1, 'Pink Bunny', '/assets/char-1.svg', '/assets/char-1-correct.svg', '/assets/char-1-wrong.svg', '{
    "displayName": "กระต่ายชมพู",
    "greeting": "สวัสดีค่ะ!",
    "correctPhrases": ["เก่งมาก!", "ถูกต้อง!", "สุดยอด!", "ยอดเยี่ยม!"],
    "wrongPhrases": ["ไม่เป็นไร ลองใหม่นะ!", "เกือบแล้ว!", "พยายามอีกนิด!"],
    "completePhrases": ["ยินดีด้วย! ทำได้ดีมาก!", "สุดยอดไปเลย!"]
}'::jsonb),
(2, 'Orange Cat', '/assets/char-2.svg', '/assets/char-2-correct.svg', '/assets/char-2-wrong.svg', '{
    "displayName": "แมวส้ม",
    "greeting": "เหมียว~",
    "correctPhrases": ["สุดยอด!", "เยี่ยมเลย!", "ถูกต้อง!", "เก่งจัง!"],
    "wrongPhrases": ["ไม่เป็นไร!", "พยายามอีกนิด!", "เกือบแล้ว!"],
    "completePhrases": ["เก่งมากเลย!", "ยินดีด้วย!"]
}'::jsonb),
(3, 'Purple Bear', '/assets/char-3.svg', '/assets/char-3-correct.svg', '/assets/char-3-wrong.svg', '{
    "displayName": "หมีม่วง",
    "greeting": "มาเล่นกัน!",
    "correctPhrases": ["ยอดเยี่ยม!", "เก่งจัง!", "ถูกต้อง!", "สุดยอด!"],
    "wrongPhrases": ["ลองอีกครั้ง!", "เกือบได้แล้ว!", "พยายามอีกนิด!"],
    "completePhrases": ["สุดยอดไปเลย!", "ทำได้ดีมาก!"]
}'::jsonb),
(4, 'Yellow Dog', '/assets/char-4.svg', '/assets/char-4-correct.svg', '/assets/char-4-wrong.svg', '{
    "displayName": "หมาเหลือง",
    "greeting": "โฮ่งโฮ่ง!",
    "correctPhrases": ["ถูกต้อง!", "เก่งมาก!", "สุดยอด!", "เยี่ยมเลย!"],
    "wrongPhrases": ["ไม่เป็นไร!", "ลองใหม่!", "เกือบแล้ว!"],
    "completePhrases": ["ยินดีด้วย!", "เก่งมากเลย!"]
}'::jsonb),
(5, 'Blue Bunny', '/assets/char-5.svg', '/assets/char-5-correct.svg', '/assets/char-5-wrong.svg', '{
    "displayName": "กระต่ายฟ้า",
    "greeting": "สวัสดีครับ!",
    "correctPhrases": ["สุดยอด!", "ถูกต้องเลย!", "เก่งมาก!", "ยอดเยี่ยม!"],
    "wrongPhrases": ["เกือบแล้ว!", "พยายามอีกนิด!", "ลองใหม่นะ!"],
    "completePhrases": ["ทำได้ดีมาก!", "สุดยอดไปเลย!"]
}'::jsonb);

-- 3) สร้างแคมเปญ checkpoint-based
INSERT INTO quiz_campaigns (id, slug, title, description, theme_id, total_checkpoints, retry_rotate_question, scene_background_url, scene_characters) VALUES
(1, 'general-knowledge', 'ความรู้รอบตัว', 'สแกน 5 จุดเช็คพอยต์ ตอบคำถามให้ครบ แลกรางวัล!', 1, 5, true, '/assets/scene-bg.svg', '{1,2,3,4,5}');

-- 4) หมวดหมู่คำถาม (1 checkpoint = 1 category)
INSERT INTO quiz_categories (id, name) VALUES
(1, 'ดาราศาสตร์และภูมิศาสตร์'),
(2, 'วิทยาศาสตร์และสิ่งประดิษฐ์'),
(3, 'ประวัติศาสตร์และสังคม'),
(4, 'ธรรมชาติและสิ่งแวดล้อม'),
(5, 'วัฒนธรรมและร่างกาย');

-- 5) Checkpoint Tokens — แต่ละจุดผูกกับ 1 category
INSERT INTO checkpoint_tokens (id, token, campaign_id, checkpoint_index, category_id, expires_at) VALUES
(1, 'dev-cp-1', 1, 1, 1, NOW() + INTERVAL '90 days'),
(2, 'dev-cp-2', 1, 2, 2, NOW() + INTERVAL '90 days'),
(3, 'dev-cp-3', 1, 3, 3, NOW() + INTERVAL '90 days'),
(4, 'dev-cp-4', 1, 4, 4, NOW() + INTERVAL '90 days'),
(5, 'dev-cp-5', 1, 5, 5, NOW() + INTERVAL '90 days');

-- ============================================================
-- 6) คำถาม 20 ข้อ — 4 ข้อต่อหมวดหมู่
-- ============================================================

-- === หมวด 1: ดาราศาสตร์และภูมิศาสตร์ (category_id=1) ===

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(1, 1, 'ดาวเคราะห์ดวงใดใกล้ดวงอาทิตย์มากที่สุด?', 'ดาวพุธ (Mercury) เป็นดาวเคราะห์ที่อยู่ใกล้ดวงอาทิตย์มากที่สุดในระบบสุริยะ', 1);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(1, 'ดาวพุธ', true, 1), (1, 'ดาวศุกร์', false, 2), (1, 'ดาวอังคาร', false, 3), (1, 'ดาวพฤหัสบดี', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(2, 1, 'สัตว์ชนิดใดเป็นสัตว์เลี้ยงลูกด้วยนมที่บินได้?', 'ค้างคาวเป็นสัตว์เลี้ยงลูกด้วยนมชนิดเดียวที่บินได้จริง', 2);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(2, 'นกเพนกวิน', false, 1), (2, 'กระรอกบิน', false, 2), (2, 'ค้างคาว', true, 3), (2, 'นกกระจอกเทศ', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(3, 1, 'ประเทศไทยมีกี่จังหวัด?', 'ประเทศไทยมี 77 จังหวัด (รวมกรุงเทพมหานคร)', 3);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(3, '75 จังหวัด', false, 1), (3, '76 จังหวัด', false, 2), (3, '77 จังหวัด', true, 3), (3, '78 จังหวัด', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(4, 1, 'แม่น้ำที่ยาวที่สุดในโลกคือแม่น้ำอะไร?', 'แม่น้ำไนล์ในทวีปแอฟริกายาวประมาณ 6,650 กิโลเมตร', 4);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(4, 'แม่น้ำอเมซอน', false, 1), (4, 'แม่น้ำไนล์', true, 2), (4, 'แม่น้ำแยงซี', false, 3), (4, 'แม่น้ำมิสซิสซิปปี', false, 4);

-- === หมวด 2: วิทยาศาสตร์และสิ่งประดิษฐ์ (category_id=2) ===

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(5, 2, 'ธาตุใดมีสัญลักษณ์ทางเคมีว่า "O"?', 'ออกซิเจน (Oxygen) มีสัญลักษณ์ทางเคมีว่า O และเลขอะตอม 8', 1);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(5, 'ทองคำ', false, 1), (5, 'ออสเมียม', false, 2), (5, 'ออกซิเจน', true, 3), (5, 'โอกาเนสซอน', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(6, 2, 'ใครเป็นผู้ประดิษฐ์หลอดไฟฟ้า?', 'โทมัส เอดิสัน พัฒนาหลอดไฟฟ้าเชิงพาณิชย์สำเร็จในปี 1879', 2);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(6, 'อัลเบิร์ต ไอน์สไตน์', false, 1), (6, 'นิโคลา เทสลา', false, 2), (6, 'โทมัส เอดิสัน', true, 3), (6, 'เบนจามิน แฟรงคลิน', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(7, 2, 'ภูเขาที่สูงที่สุดในโลกคือภูเขาอะไร?', 'ยอดเขาเอเวอเรสต์สูง 8,849 เมตร เหนือระดับน้ำทะเล', 3);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(7, 'ภูเขาคิลิมันจาโร', false, 1), (7, 'ภูเขาเอเวอเรสต์', true, 2), (7, 'ภูเขาเค2', false, 3), (7, 'ภูเขามงต์บลังค์', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(8, 2, 'สีใดไม่ใช่แม่สีของแสง?', 'แม่สีของแสง (RGB) คือ แดง เขียว น้ำเงิน ส่วนเหลืองเป็นแม่สีของสารสี', 4);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(8, 'แดง', false, 1), (8, 'เขียว', false, 2), (8, 'น้ำเงิน', false, 3), (8, 'เหลือง', true, 4);

-- === หมวด 3: ประวัติศาสตร์และสังคม (category_id=3) ===

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(9, 3, 'กรุงเทพมหานครก่อตั้งเมื่อปี พ.ศ. ใด?', 'พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกทรงสถาปนากรุงเทพฯ เมื่อ พ.ศ. 2325', 1);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(9, 'พ.ศ. 2310', false, 1), (9, 'พ.ศ. 2325', true, 2), (9, 'พ.ศ. 2350', false, 3), (9, 'พ.ศ. 2400', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(10, 3, 'DNA ย่อมาจากอะไร?', 'DNA = Deoxyribonucleic Acid เป็นโมเลกุลที่เก็บข้อมูลทางพันธุกรรม', 2);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(10, 'Deoxyribonucleic Acid', true, 1), (10, 'Dinitrogen Acid', false, 2), (10, 'Dynamic Nuclear Acid', false, 3), (10, 'Deoxyribose Nucleic Atom', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(11, 3, 'มหาสมุทรใดมีขนาดใหญ่ที่สุดในโลก?', 'มหาสมุทรแปซิฟิกมีพื้นที่ประมาณ 165.25 ล้านตารางกิโลเมตร ใหญ่ที่สุดในโลก', 3);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(11, 'มหาสมุทรแอตแลนติก', false, 1), (11, 'มหาสมุทรแปซิฟิก', true, 2), (11, 'มหาสมุทรอินเดีย', false, 3), (11, 'มหาสมุทรอาร์กติก', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(12, 3, 'ประเทศใดมีประชากรมากที่สุดในโลก?', 'อินเดียแซงหน้าจีนขึ้นเป็นประเทศที่มีประชากรมากที่สุดในโลกในปี 2023', 4);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(12, 'จีน', false, 1), (12, 'อินเดีย', true, 2), (12, 'สหรัฐอเมริกา', false, 3), (12, 'อินโดนีเซีย', false, 4);

-- === หมวด 4: ธรรมชาติและสิ่งแวดล้อม (category_id=4) ===

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(13, 4, 'วิตามินซีพบมากในผลไม้ชนิดใด?', 'ฝรั่งมีวิตามินซีสูงมาก ประมาณ 228 mg ต่อ 100 กรัม มากกว่าส้มหลายเท่า', 1);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(13, 'กล้วย', false, 1), (13, 'แอปเปิ้ล', false, 2), (13, 'ฝรั่ง', true, 3), (13, 'องุ่น', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(14, 4, 'ทวีปใดมีพื้นที่เล็กที่สุด?', 'ออสเตรเลีย (โอเชียเนีย) มีพื้นที่ประมาณ 8.5 ล้านตารางกิโลเมตร เล็กที่สุดใน 7 ทวีป', 2);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(14, 'ยุโรป', false, 1), (14, 'แอนตาร์กติกา', false, 2), (14, 'ออสเตรเลีย', true, 3), (14, 'อเมริกาใต้', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(15, 4, 'สัตว์บกชนิดใดวิ่งเร็วที่สุดในโลก?', 'เสือชีตาห์วิ่งได้เร็วสูงสุดประมาณ 112 กิโลเมตรต่อชั่วโมง', 3);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(15, 'ม้า', false, 1), (15, 'เสือชีตาห์', true, 2), (15, 'สิงโต', false, 3), (15, 'กวาง', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(16, 4, 'ก๊าซใดมีปริมาณมากที่สุดในบรรยากาศโลก?', 'ไนโตรเจนมีสัดส่วนประมาณ 78% ของบรรยากาศโลก', 4);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(16, 'ออกซิเจน', false, 1), (16, 'ไนโตรเจน', true, 2), (16, 'คาร์บอนไดออกไซด์', false, 3), (16, 'ไฮโดรเจน', false, 4);

-- === หมวด 5: วัฒนธรรมและร่างกาย (category_id=5) ===

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(17, 5, 'ดอกไม้ประจำชาติไทยคือดอกอะไร?', 'ดอกราชพฤกษ์ (ดอกคูน) เป็นดอกไม้ประจำชาติไทย มีสีเหลืองทอง', 1);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(17, 'ดอกบัว', false, 1), (17, 'ดอกกุหลาบ', false, 2), (17, 'ดอกราชพฤกษ์', true, 3), (17, 'ดอกมะลิ', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(18, 5, 'โลกหมุนรอบตัวเองใช้เวลาประมาณกี่ชั่วโมง?', 'โลกหมุนรอบตัวเอง 1 รอบ ใช้เวลาประมาณ 24 ชั่วโมง (23 ชั่วโมง 56 นาที)', 2);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(18, '12 ชั่วโมง', false, 1), (18, '24 ชั่วโมง', true, 2), (18, '36 ชั่วโมง', false, 3), (18, '48 ชั่วโมง', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(19, 5, 'กระดูกส่วนใดเล็กที่สุดในร่างกายมนุษย์?', 'กระดูกโกลน (Stapes) ในหูชั้นกลางยาวเพียง 2.5-3.3 มม. เป็นกระดูกที่เล็กที่สุด', 3);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(19, 'กระดูกนิ้วก้อย', false, 1), (19, 'กระดูกโกลนในหู', true, 2), (19, 'กระดูกจมูก', false, 3), (19, 'กระดูกสะบ้า', false, 4);

INSERT INTO quiz_questions (id, category_id, question_text, explanation, sort_order) VALUES
(20, 5, 'ภาษาใดมีผู้พูดเป็นภาษาแม่มากที่สุดในโลก?', 'ภาษาจีนกลาง (Mandarin) มีผู้พูดเป็นภาษาแม่มากกว่า 900 ล้านคน', 4);
INSERT INTO quiz_choices (question_id, choice_text, is_correct, sort_order) VALUES
(20, 'ภาษาอังกฤษ', false, 1), (20, 'ภาษาสเปน', false, 2), (20, 'ภาษาจีนกลาง', true, 3), (20, 'ภาษาฮินดี', false, 4);

-- รีเซ็ต sequence
SELECT setval('quiz_themes_id_seq', (SELECT MAX(id) FROM quiz_themes));
SELECT setval('quiz_characters_id_seq', (SELECT MAX(id) FROM quiz_characters));
SELECT setval('quiz_campaigns_id_seq', (SELECT MAX(id) FROM quiz_campaigns));
SELECT setval('quiz_categories_id_seq', (SELECT MAX(id) FROM quiz_categories));
SELECT setval('checkpoint_tokens_id_seq', (SELECT MAX(id) FROM checkpoint_tokens));
SELECT setval('quiz_questions_id_seq', (SELECT MAX(id) FROM quiz_questions));
SELECT setval('quiz_choices_id_seq', (SELECT MAX(id) FROM quiz_choices));
