const YES_NO = ['Yes', 'No'];
const DATE_PATTERN = /^\d{1,2} [A-Z][a-z]+, \d{4}$/;

const pages = [
  {
    id: 'personal',
    step: 'Personal',
    sub: 'Personal details',
    title: 'Personal details',
    note: 'Names must match the passport. A red mark means the website requires an answer.',
    blocks: [
      {
        title: 'Immigration adviser',
        rows: [
          { path: 'contact.has_agent', label: 'Are you represented by an immigration adviser?', type: 'yesno', required: true }
        ]
      },
      {
        title: 'Personal details',
        rows: [
          { path: 'personal.family_name', label: 'Family name', required: true },
          { path: 'personal.given_name_1', label: 'Given name 1', required: true },
          { path: 'personal.given_name_2', label: 'Given name 2' },
          { path: 'personal.given_name_3', label: 'Given name 3' },
          { path: 'personal.other_names', label: 'Any other names you are or have ever been known by' },
          { path: 'personal.title', label: 'Title', type: 'select', options: ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Other'], required: true },
          { path: 'personal.other_title', label: 'Please specify your title', showWhen: 'personal.title=Other', required: true },
          { path: 'personal.gender', label: 'Gender', type: 'select', options: ['Female', 'Male'], required: true },
          { path: 'personal.date_of_birth', label: 'Date of birth', type: 'date', required: true },
          { path: 'personal.country_of_birth', label: 'Country of birth', required: true, hint: 'Use the name shown in the website dropdown.' }
        ]
      },
      {
        title: 'Address',
        rows: [
          { path: 'address.street_number', label: 'Street number', required: true },
          { path: 'address.street_name', label: 'Street name', required: true },
          { path: 'address.suburb', label: 'Suburb', required: true },
          { path: 'address.city', label: 'City', required: true },
          { path: 'address.province', label: 'Province / state', required: true },
          { path: 'address.postal_code', label: 'Postal code', required: true },
          { path: 'address.country', label: 'Country', required: true, hint: 'Use the name shown in the website dropdown.' }
        ]
      },
      {
        title: 'Contact details',
        rows: [
          { path: 'contact.phone_daytime', label: 'Phone number (daytime)' },
          { path: 'contact.phone_night', label: 'Phone number (night)' },
          { path: 'contact.phone_mobile', label: 'Mobile phone number', required: true },
          { path: 'contact.fax', label: 'Fax number' },
          { path: 'contact.email', label: 'Email address', type: 'email', required: true },
          { path: 'contact.communication_method', label: 'Preferred method of communication', type: 'select', options: ['Email', 'Phone', 'Fax', 'Post'], required: true },
          { path: 'contact.has_credit_card', label: 'Do you have a credit card to pay the application fee online?', type: 'yesno', required: true }
        ]
      }
    ]
  },
  {
    id: 'identification',
    step: 'Personal',
    sub: 'Identification',
    title: 'Identification',
    note: 'Passport details must be typed exactly. The website asks for the passport number twice.',
    blocks: [
      {
        title: 'Passport details',
        rows: [
          { path: 'identification.passport_number', label: 'Passport number', required: true },
          { confirm: 'identification.passport_number', label: 'Confirm passport number', required: true },
          { path: 'identification.passport_expiry', label: 'Passport expiry date', type: 'date', required: true },
          { path: 'identification.passport_citizenship', label: 'Country of citizenship', required: true, hint: 'As shown in the passport.' }
        ]
      },
      {
        title: 'Second form of identification',
        rows: [
          { path: 'identification.id_type', label: 'Identity document type', type: 'select', options: ['National ID', 'Birth certificate', 'Driver licence'], required: true },
          { path: 'identification.id_issue_date', label: 'Issue date', type: 'date', required: true },
          { path: 'identification.id_expiry_date', label: 'Expiry date', type: 'date', required: true }
        ]
      }
    ]
  },
  {
    id: 'occupation',
    step: 'Personal',
    sub: 'Occupation',
    title: 'Occupation details',
    note: 'This page is optional on the website. Leave both fields blank if none of the choices fit.',
    blocks: [
      {
        title: 'Occupation',
        rows: [
          { path: 'occupation.industry_search', label: 'Industry' },
          { path: 'occupation.occupation_search', label: 'Occupation' }
        ]
      }
    ]
  },
  {
    id: 'health',
    step: 'Health',
    title: 'Health',
    note: 'Answer every question Yes or No. Use the details box only when an answer is Yes.',
    blocks: [
      {
        title: 'Medical conditions',
        rows: [
          { path: 'health.renal_dialysis', label: 'Do you have any medical condition that requires, or may require, renal dialysis during your stay in New Zealand?', type: 'yesno', required: true },
          { path: 'health.active_tb', label: 'Do you have tuberculosis (TB)?', type: 'yesno', required: true },
          { path: 'health.cancer', label: 'Do you have cancer?', type: 'yesno', required: true },
          { path: 'health.heart_disease', label: 'Do you have heart disease?', type: 'yesno', required: true },
          { path: 'health.disability', label: 'Do you have a physical, mental or intellectual disability?', type: 'yesno', required: true },
          { path: 'health.hospitalisation', label: 'Do you have any medical condition that requires, or may require, hospital care during your stay in New Zealand?', type: 'yesno', required: true },
          { path: 'health.residential_care', label: 'Do you require residential care?', type: 'yesno', required: true },
          { path: 'health.pregnancy', label: 'Are you pregnant?', type: 'yesno', required: true },
          { path: 'health.tb_risk', label: 'Have you spent three months or more in the last five years in a country that is not a low TB-risk country?', type: 'yesno', required: true },
          { path: 'health.medical_details', label: 'If you answered Yes to any question, provide details', type: 'textarea' }
        ]
      }
    ]
  },
  {
    id: 'character',
    step: 'Character',
    title: 'Character',
    note: 'Answer every question. Provide details if any answer is Yes.',
    blocks: [
      {
        title: 'Character questions',
        rows: [
          { path: 'character.imprisonment_5_years', label: 'Have you ever been convicted of any offence for which you were sentenced to imprisonment for five years or more?', type: 'yesno', required: true },
          { path: 'character.imprisonment_12_months', label: 'In the last 10 years, have you been convicted of any offence for which you were sentenced to imprisonment for 12 months or more?', type: 'yesno', required: true },
          { path: 'character.deported', label: 'Have you ever been deported from any country?', type: 'yesno', required: true },
          { path: 'character.removal_order', label: 'Have you ever been the subject of a removal order?', type: 'yesno', required: true },
          { path: 'character.charged', label: 'Have you ever been charged with any offence?', type: 'yesno', required: true },
          { path: 'character.convicted', label: 'Have you ever been convicted of any offence?', type: 'yesno', required: true },
          { path: 'character.under_investigation', label: 'Are you currently under investigation for any offence?', type: 'yesno', required: true },
          { path: 'character.excluded', label: 'Have you ever been excluded (refused entry) from any country?', type: 'yesno', required: true },
          { path: 'character.removed', label: 'Have you ever been removed from any country?', type: 'yesno', required: true },
          { path: 'character.details', label: 'If you answered Yes to any question, provide details', type: 'textarea' }
        ]
      }
    ]
  },
  {
    id: 'whs',
    step: 'WHS Specific',
    title: 'Working Holiday Specific',
    note: 'These are the questions for an application made outside New Zealand.',
    blocks: [
      {
        title: 'Scheme',
        rows: [
          { path: 'scheme_country', label: 'Working holiday scheme country', required: true, hint: 'Type the same country as Scheme country in Settings. Example: Japan.' }
        ]
      },
      {
        title: 'Working holiday questions',
        rows: [
          { path: 'whs.previous_whs_visa', label: 'Have you previously been issued a New Zealand working holiday visa?', type: 'yesno', required: true },
          { path: 'whs.sufficient_funds_holiday', label: 'Do you have sufficient funds available for your working holiday?', type: 'yesno', required: true },
          { path: 'whs.travel_date', label: 'What date do you intend to travel to New Zealand?', type: 'date', required: true },
          { path: 'whs.been_to_nz', label: 'Have you been to New Zealand before?', type: 'yesno', required: true },
          { path: 'whs.been_to_nz_when', label: 'If yes, when?', type: 'date', showWhen: 'whs.been_to_nz=Yes', required: true },
          { path: 'whs.sufficient_funds_onward_ticket', label: 'Do you have sufficient funds for an outward ticket?', type: 'yesno', required: true },
          { path: 'whs.meet_scheme_requirements', label: 'Do you meet the specific requirements for your country\'s working holiday scheme?', type: 'yesno', required: true },
          { path: 'whs.length_of_stay', label: 'Intended length of stay', type: 'select', options: ['6 months', '12 months'] }
        ]
      }
    ]
  },
  {
    id: 'declaration',
    step: 'Declaration',
    title: 'Declaration',
    note: 'On the website each statement is a Yes box. The runner ticks them only when every box here is accepted.',
    blocks: [
      {
        title: 'Declaration statements',
        rows: [
          { path: 'declaration.false_statement', label: 'I understand that if I make any false statement, or provide any false or misleading information, my application may be declined or my visa may later be revoked.', type: 'check', required: true },
          { path: 'declaration.notes_and_questions', label: 'I have read and understood the notes and questions in this form, and I declare the information given is true and complete.', type: 'check', required: true },
          { path: 'declaration.changed_circumstances', label: 'I agree to tell Immigration New Zealand about any changes to my circumstances that occur after I make this application.', type: 'check', required: true },
          { path: 'declaration.good_character', label: 'I declare that the character information I have given is complete, including any charges, investigations or warrants.', type: 'check', required: true },
          { path: 'declaration.information_sharing', label: 'I authorise Immigration New Zealand to share information about me as described in the form.', type: 'check', required: true },
          { path: 'declaration.health_information', label: 'I authorise Immigration New Zealand to collect and use health information about me.', type: 'check', required: true },
          { path: 'declaration.advice', label: 'I understand the notes about receiving immigration advice.', type: 'check', required: true },
          { path: 'declaration.occupation_registration', label: 'I understand the occupational registration requirements where they apply to me.', type: 'check', required: true },
          { path: 'declaration.entitlement', label: 'I understand what this visa entitles me to do.', type: 'check', required: true },
          { path: 'declaration.permit_expiry', label: 'I agree to leave New Zealand before my visa expires.', type: 'check', required: true },
          { path: 'declaration.medical_insurance', label: 'I agree to hold medical insurance or pay for any health care I need if I am not entitled to free care.', type: 'check', required: true }
        ]
      }
    ]
  },
  {
    id: 'payer',
    step: 'Payer',
    title: 'Card holder',
    note: 'This is the name asked on the payer page, before the secure payment site. Card numbers are not stored here.',
    blocks: [
      {
        title: 'Payer',
        rows: [
          { path: 'payment.payer_name', label: 'Card holder\'s name', required: true }
        ]
      }
    ]
  }
];

const pageOrder = pages.map(page => page.id);

function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function eachField() {
  return pages.flatMap(page => page.blocks.flatMap(block => block.rows));
}

function fieldPaths() {
  return eachField().map(field => field.path).filter(Boolean);
}

function validateApplicant(applicant) {
  for (const field of eachField()) {
    if (field.type !== 'date' || !field.path) continue;
    if (field.showWhen && !shown(applicant, field.showWhen)) continue;
    const value = String(readPath(applicant, field.path) || '').trim();
    if (value && !DATE_PATTERN.test(value)) throw new Error(`${t(field.label)} phải theo dạng 24 May, 1996.`);
  }
}

function shown(applicant, rule) {
  const [path, expected] = rule.split('=');
  return String(readPath(applicant, path) || '') === expected;
}

const translations = {
  'Working Holiday Schemes': 'Chương trình Working Holiday',
  'Online application': 'Đơn trực tuyến',
  'Select': 'Chọn',
  'Previous': 'Trước',
  'Next': 'Tiếp',
  'Can be left blank': 'Có thể để trống',
  'Accounts': 'Tài khoản',
  'Add account': 'Thêm tài khoản',
  'Username': 'Tên đăng nhập',
  'Password': 'Mật khẩu',
  'Use proxy list': 'Dùng proxy',
  'Proxy (optional)': 'Proxy (không bắt buộc)',
  'Remove': 'Xóa',
  'Open payment': 'Mở trang thanh toán',
  'Personal': 'Cá nhân',
  'Health': 'Sức khỏe',
  'Character': 'Lý lịch',
  'WHS Specific': 'Riêng Working Holiday',
  'Declaration': 'Cam kết',
  'Payer': 'Người trả tiền',
  'Personal details': 'Thông tin cá nhân',
  'Identification': 'Giấy tờ',
  'Occupation': 'Nghề nghiệp',
  'Names must match the passport. A red mark means the website requires an answer.': 'Tên phải trùng hộ chiếu. Dấu ! là ô website bắt buộc. Ô không có dấu ! có thể để trống.',
  'Immigration adviser': 'Cố vấn di trú',
  'Are you represented by an immigration adviser?': 'Bạn có người đại diện là cố vấn di trú không?',
  'Family name': 'Họ',
  'Given name 1': 'Tên 1',
  'Given name 2': 'Tên 2',
  'Given name 3': 'Tên 3',
  'Any other names you are or have ever been known by': 'Tên khác bạn đã hoặc đang dùng',
  'Title': 'Danh xưng',
  'Please specify your title': 'Ghi rõ danh xưng',
  'Gender': 'Giới tính',
  'Date of birth': 'Ngày sinh',
  'Country of birth': 'Nước sinh',
  'Use the name shown in the website dropdown.': 'Gõ đúng tên nước như trong danh sách trên website.',
  'Address': 'Địa chỉ',
  'Street number': 'Số nhà',
  'Street name': 'Tên đường',
  'Suburb': 'Phường / khu vực',
  'City': 'Thành phố',
  'Province / state': 'Tỉnh / bang',
  'Postal code': 'Mã bưu chính',
  'Country': 'Quốc gia',
  'Contact details': 'Thông tin liên hệ',
  'Phone number (daytime)': 'Điện thoại ban ngày',
  'Phone number (night)': 'Điện thoại ban đêm',
  'Mobile phone number': 'Số di động',
  'Fax number': 'Số fax',
  'Email address': 'Email',
  'Preferred method of communication': 'Cách liên hệ mong muốn',
  'Do you have a credit card to pay the application fee online?': 'Bạn có thẻ tín dụng để nộp phí trực tuyến không?',
  'Passport details must be typed exactly. The website asks for the passport number twice.': 'Số hộ chiếu phải gõ đúng. Website yêu cầu nhập hai lần.',
  'Passport details': 'Hộ chiếu',
  'Passport number': 'Số hộ chiếu',
  'Confirm passport number': 'Nhập lại số hộ chiếu',
  'Passport expiry date': 'Ngày hết hạn hộ chiếu',
  'Country of citizenship': 'Quốc tịch trên hộ chiếu',
  'As shown in the passport.': 'Đúng như trên hộ chiếu.',
  'Second form of identification': 'Giấy tờ thứ hai',
  'Identity document type': 'Loại giấy tờ',
  'Issue date': 'Ngày cấp',
  'Expiry date': 'Ngày hết hạn',
  'Occupation details': 'Thông tin nghề nghiệp',
  'This page is optional on the website. Leave both fields blank if none of the choices fit.': 'Trang này trên website không bắt buộc. Có thể để trống nếu không có lựa chọn phù hợp.',
  'Industry': 'Ngành nghề',
  'Answer every question Yes or No. Use the details box only when an answer is Yes.': 'Mỗi câu chọn Có hoặc Không. Chỉ ghi chi tiết khi có câu trả lời Có.',
  'Medical conditions': 'Tình trạng sức khỏe',
  'Do you have any medical condition that requires, or may require, renal dialysis during your stay in New Zealand?': 'Bạn có bệnh nào cần hoặc có thể cần lọc máu trong thời gian ở New Zealand không?',
  'Do you have tuberculosis (TB)?': 'Bạn có bệnh lao không?',
  'Do you have cancer?': 'Bạn có bệnh ung thư không?',
  'Do you have heart disease?': 'Bạn có bệnh tim không?',
  'Do you have a physical, mental or intellectual disability?': 'Bạn có khuyết tật thể chất, tâm thần hoặc trí tuệ không?',
  'Do you have any medical condition that requires, or may require, hospital care during your stay in New Zealand?': 'Bạn có bệnh nào cần hoặc có thể cần nằm viện trong thời gian ở New Zealand không?',
  'Do you require residential care?': 'Bạn có cần được chăm sóc tại cơ sở lưu trú không?',
  'Are you pregnant?': 'Bạn có đang mang thai không?',
  'Have you spent three months or more in the last five years in a country that is not a low TB-risk country?': 'Trong 5 năm gần đây, bạn có ở từ 3 tháng trở lên tại nước không thuộc nhóm ít nguy cơ lao không?',
  'If you answered Yes to any question, provide details': 'Nếu có câu trả lời Có, hãy ghi chi tiết',
  'Answer every question. Provide details if any answer is Yes.': 'Trả lời hết các câu. Nếu có câu Có, hãy ghi chi tiết.',
  'Character questions': 'Câu hỏi lý lịch',
  'Have you ever been convicted of any offence for which you were sentenced to imprisonment for five years or more?': 'Bạn đã từng bị kết án tù từ 5 năm trở lên chưa?',
  'In the last 10 years, have you been convicted of any offence for which you were sentenced to imprisonment for 12 months or more?': 'Trong 10 năm gần đây, bạn đã từng bị kết án tù từ 12 tháng trở lên chưa?',
  'Have you ever been deported from any country?': 'Bạn đã từng bị trục xuất khỏi nước nào chưa?',
  'Have you ever been the subject of a removal order?': 'Bạn đã từng thuộc diện lệnh đưa ra khỏi nước chưa?',
  'Have you ever been charged with any offence?': 'Bạn đã từng bị buộc tội chưa?',
  'Have you ever been convicted of any offence?': 'Bạn đã từng bị kết án chưa?',
  'Are you currently under investigation for any offence?': 'Bạn hiện có đang bị điều tra về một tội nào không?',
  'Have you ever been excluded (refused entry) from any country?': 'Bạn đã từng bị từ chối nhập cảnh vào nước nào chưa?',
  'Have you ever been removed from any country?': 'Bạn đã từng bị đưa ra khỏi nước nào chưa?',
  'Working Holiday Specific': 'Câu hỏi riêng Working Holiday',
  'These are the questions for an application made outside New Zealand.': 'Đây là các câu khi nộp đơn từ bên ngoài New Zealand.',
  'Scheme': 'Chương trình',
  'Working holiday scheme country': 'Quốc gia chương trình Working Holiday',
  'The country you select before Apply now, for example CROATIA.': 'Quốc gia bạn chọn trước khi bấm Apply now, ví dụ CROATIA.',
  'Type the same country as Scheme country in Settings. Example: Japan.': 'Gõ cùng quốc gia với ô Quốc gia chương trình trong Cài đặt. Ví dụ: Japan.',
  'Working holiday questions': 'Câu hỏi Working Holiday',
  'Have you previously been issued a New Zealand working holiday visa?': 'Bạn đã từng được cấp visa Working Holiday New Zealand chưa?',
  'Do you have sufficient funds available for your working holiday?': 'Bạn có đủ tiền cho chuyến Working Holiday không?',
  'What date do you intend to travel to New Zealand?': 'Bạn dự định đến New Zealand ngày nào?',
  'Have you been to New Zealand before?': 'Bạn đã từng đến New Zealand chưa?',
  'If yes, when?': 'Nếu rồi, vào lúc nào?',
  'Do you have sufficient funds for an outward ticket?': 'Bạn có đủ tiền mua vé rời New Zealand không?',
  'Do you meet the specific requirements for your country\'s working holiday scheme?': 'Bạn có đủ điều kiện riêng của chương trình Working Holiday nước bạn không?',
  'Intended length of stay': 'Thời gian dự định ở lại',
  'On the website each statement is a Yes box. The runner ticks them only when every box here is accepted.': 'Trên website mỗi câu là một ô Yes. Tool chỉ tick khi tất cả ô ở đây đều được chọn.',
  'Declaration statements': 'Các câu cam kết',
  'I understand that if I make any false statement, or provide any false or misleading information, my application may be declined or my visa may later be revoked.': 'Tôi hiểu rằng nếu khai sai hoặc cung cấp thông tin gây hiểu nhầm, đơn có thể bị từ chối hoặc visa có thể bị hủy sau này.',
  'I have read and understood the notes and questions in this form, and I declare the information given is true and complete.': 'Tôi đã đọc và hiểu các ghi chú, câu hỏi trong đơn, và khai báo thông tin là đúng và đủ.',
  'I agree to tell Immigration New Zealand about any changes to my circumstances that occur after I make this application.': 'Tôi đồng ý báo Immigration New Zealand nếu hoàn cảnh thay đổi sau khi nộp đơn.',
  'I declare that the character information I have given is complete, including any charges, investigations or warrants.': 'Tôi khai đầy đủ thông tin lý lịch, kể cả cáo buộc, điều tra hoặc lệnh truy nã.',
  'I authorise Immigration New Zealand to share information about me as described in the form.': 'Tôi cho phép Immigration New Zealand chia sẻ thông tin của tôi như đã ghi trong đơn.',
  'I authorise Immigration New Zealand to collect and use health information about me.': 'Tôi cho phép Immigration New Zealand thu thập và dùng thông tin sức khỏe của tôi.',
  'I understand the notes about receiving immigration advice.': 'Tôi hiểu các ghi chú về việc nhận tư vấn di trú.',
  'I understand the occupational registration requirements where they apply to me.': 'Tôi hiểu yêu cầu đăng ký hành nghề nếu yêu cầu đó áp dụng với tôi.',
  'I understand what this visa entitles me to do.': 'Tôi hiểu visa này cho phép tôi làm gì.',
  'I agree to leave New Zealand before my visa expires.': 'Tôi đồng ý rời New Zealand trước khi visa hết hạn.',
  'I agree to hold medical insurance or pay for any health care I need if I am not entitled to free care.': 'Tôi đồng ý có bảo hiểm y tế hoặc tự trả chi phí khám chữa nếu không được miễn phí.',
  'Card holder': 'Chủ thẻ',
  'This is the name asked on the payer page, before the secure payment site. Card numbers are not stored here.': 'Đây là tên được hỏi ở trang người trả tiền, trước trang thanh toán. Không lưu số thẻ ở đây.',
  'Card holder\'s name': 'Tên chủ thẻ',
  'Yes': 'Có',
  'No': 'Không',
  'Mr': 'Ông',
  'Mrs': 'Bà',
  'Miss': 'Cô',
  'Ms': 'Ms',
  'Dr': 'Tiến sĩ',
  'Other': 'Khác',
  'Female': 'Nữ',
  'Male': 'Nam',
  'Email': 'Email',
  'Phone': 'Điện thoại',
  'Fax': 'Fax',
  'Post': 'Thư',
  'National ID': 'Căn cước công dân',
  'Birth certificate': 'Giấy khai sinh',
  'Driver licence': 'Bằng lái xe',
  '6 months': '6 tháng',
  '12 months': '12 tháng',
  'Live progress': 'Tiến độ trực tiếp',
  'The page you are on, and the fields already filled. Nothing extra is clicked on the website.': 'Trang đang đứng và ô đã điền. Không bấm thêm trên website.',
  'Solving captcha': 'Đang giải captcha',
  'Captcha solved': 'Đã giải captcha',
  'Captcha failed': 'Giải captcha không xong',
  'Filled': 'Đã điền',
  'Not found on page': 'Không thấy trên trang',
  'Waiting for the website': 'Đang chờ website'
};

let language = 'en';

function viText(en) {
  return Object.prototype.hasOwnProperty.call(translations, en) ? translations[en] : en;
}

function t(en) {
  return language === 'vi' ? viText(en) : en;
}

function hasTranslation(en) {
  return Object.prototype.hasOwnProperty.call(translations, en);
}

function stamp(node, en) {
  node.dataset.en = en;
  node.dataset.vi = viText(en);
  node.textContent = t(en);
}

function optionPresentation(canonical, lang = language) {
  if (canonical === 'Select') return { value: '', text: lang === 'vi' ? viText('Select') : 'Select' };
  const gloss = viText(canonical);
  const text = lang === 'vi' && gloss !== canonical ? `${canonical} (${gloss})` : canonical;
  return { value: canonical, text };
}

function paintOption(node, canonical) {
  const view = optionPresentation(canonical);
  node.dataset.en = canonical;
  node.dataset.vi = viText(canonical);
  node.textContent = view.text;
  node.value = view.value;
}

function applyLanguage(next) {
  language = next === 'en' ? 'en' : 'vi';
  document.querySelectorAll('[data-en]').forEach(node => {
    if (node.tagName === 'OPTION') {
      const view = optionPresentation(node.dataset.en);
      node.textContent = view.text;
      node.value = view.value;
      return;
    }
    node.textContent = node.dataset[language] || node.dataset.en;
  });
  document.querySelectorAll('.inz-lang').forEach(button => button.classList.toggle('active', button.dataset.lang === language));
  try { localStorage.setItem('inz-lang', language); } catch {}
}

function initialLanguage() {
  try {
    const saved = localStorage.getItem('inz-lang');
    if (saved === 'en' || saved === 'vi') return saved;
  } catch {}
  return 'vi';
}

function optionList(field) {
  return field.type === 'yesno' ? YES_NO : field.options || [];
}

function collectCopy() {
  const values = new Set(['Select', 'Previous', 'Next', 'Can be left blank', 'Accounts', 'Add account', 'Working Holiday Schemes', 'Online application', 'Username', 'Password', 'Email', 'Proxy (optional)', 'Use proxy list', 'Remove', 'Open payment']);
  for (const page of pages) {
    values.add(page.step);
    if (page.sub) values.add(page.sub);
    values.add(page.title);
    if (page.note) values.add(page.note);
    for (const block of page.blocks) {
      values.add(block.title);
      for (const field of block.rows) {
        values.add(field.label);
        if (field.hint) values.add(field.hint);
        for (const option of optionList(field)) values.add(option);
      }
    }
  }
  return [...values];
}

function buildInzWizard(root) {
  root.replaceChildren();
  const bar = document.createElement('div');
  bar.className = 'inz-bar';
  const titles = document.createElement('div');
  const heading = document.createElement('strong');
  const caption = document.createElement('span');
  stamp(heading, 'Working Holiday Schemes');
  stamp(caption, 'Online application');
  titles.append(heading, caption);
  const switcher = document.createElement('div');
  switcher.className = 'inz-lang-switch';
  switcher.append(languageButton('vi', 'Tiếng Việt'), languageButton('en', 'English'));
  switcher.addEventListener('click', event => {
    const next = event.target.closest('[data-lang]')?.dataset.lang;
    if (next) applyLanguage(next);
  });
  bar.append(titles, switcher);

  const steps = document.createElement('nav');
  steps.className = 'inz-steps';
  steps.setAttribute('aria-label', 'Application sections');
  const seen = new Set();
  for (const page of pages) {
    if (seen.has(page.step)) continue;
    seen.add(page.step);
    steps.append(stepButton(page.step === 'Personal' ? 'personal' : page.id, page.step, 'inz-main-tab'));
  }
  const subnav = document.createElement('nav');
  subnav.className = 'inz-subnav';
  subnav.setAttribute('aria-label', 'Personal subsections');
  for (const page of pages.filter(page => page.step === 'Personal')) subnav.append(stepButton(page.id, page.sub, 'inz-sub-tab'));

  const sheet = document.createElement('div');
  sheet.className = 'inz-sheet';
  for (const page of pages) sheet.append(renderPage(page));

  const accountsTitle = document.querySelector('#accountsTitle');
  const addAccountButton = document.querySelector('#addAccount');
  if (accountsTitle) stamp(accountsTitle, 'Accounts');
  if (addAccountButton) stamp(addAccountButton, 'Add account');
  root.append(bar, steps, subnav, sheet);
  applyLanguage(initialLanguage());
}

function languageButton(lang, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'inz-lang';
  button.dataset.lang = lang;
  button.textContent = label;
  return button;
}

function stepButton(id, label, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `form-tab ${className}${id === 'personal' ? ' active' : ''}`;
  button.dataset.formTab = id;
  stamp(button, label);
  return button;
}

function renderPage(page) {
  const section = document.createElement('section');
  section.className = `form-section${page.id === 'personal' ? ' active' : ''}`;
  section.dataset.formSection = page.id;
  const title = document.createElement('h4');
  title.className = 'inz-page-title';
  stamp(title, page.title);
  section.append(title);
  if (page.note) {
    const note = document.createElement('p');
    note.className = 'inz-note';
    stamp(note, page.note);
    section.append(note);
  }
  for (const block of page.blocks) section.append(renderBlock(block));
  const pager = document.createElement('div');
  pager.className = 'inz-pager';
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'inz-next';
  previous.dataset.inzNav = 'previous';
  stamp(previous, 'Previous');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'inz-next inz-next-primary';
  next.dataset.inzNav = 'next';
  stamp(next, 'Next');
  pager.append(previous, next);
  section.append(pager);
  return section;
}

function renderBlock(block) {
  const wrap = document.createElement('section');
  wrap.className = 'inz-block';
  const title = document.createElement('h5');
  stamp(title, block.title);
  wrap.append(title);
  for (const field of block.rows) wrap.append(renderRow(field));
  return wrap;
}

function fieldId(field) {
  return `inz-${(field.path || field.confirm || field.label).replace(/[^a-z0-9]+/gi, '-')}`;
}

function renderRow(field) {
  const row = document.createElement('div');
  row.className = field.type === 'check' ? 'inz-declaration' : 'inz-row';
  if (field.showWhen) {
    row.dataset.showWhen = field.showWhen;
    row.hidden = true;
  }
  const id = fieldId(field);
  const label = document.createElement('label');
  label.htmlFor = id;
  const text = document.createElement('span');
  stamp(text, field.label);
  if (field.required) {
    const mark = document.createElement('span');
    mark.className = 'req';
    mark.textContent = '!';
    label.append(mark, document.createTextNode(' '), text);
  } else {
    const optional = document.createElement('span');
    optional.className = 'optional-note';
    stamp(optional, 'Can be left blank');
    label.append(text, optional);
  }
  if (field.hint) {
    const hint = document.createElement('small');
    stamp(hint, field.hint);
    label.append(hint);
  }
  if (field.type === 'check') {
    const token = document.createElement('span');
    token.className = 'json-token';
    token.textContent = 'No';
    label.prepend(token);
    const input = document.createElement('input');
    input.id = id;
    input.type = 'checkbox';
    input.dataset.path = field.path;
    input.dataset.declaration = 'true';
    row.append(input, label);
    return row;
  }
  const control = renderControl(field);
  control.id = id;
  row.append(label, control);
  return row;
}

function renderControl(field) {
  if (field.type === 'yesno' || field.type === 'select') {
    const select = document.createElement('select');
    select.dataset.path = field.path;
    const blank = document.createElement('option');
    paintOption(blank, 'Select');
    select.append(blank);
    for (const option of optionList(field)) {
      const node = document.createElement('option');
      paintOption(node, option);
      select.append(node);
    }
    return select;
  }
  if (field.type === 'textarea') {
    const area = document.createElement('textarea');
    area.dataset.path = field.path;
    return area;
  }
  const input = document.createElement('input');
  if (field.confirm) input.dataset.confirm = field.confirm;
  else input.dataset.path = field.path;
  if (field.type === 'email') input.type = 'email';
  if (field.type === 'date') input.placeholder = '24 May, 1996';
  input.autocomplete = 'off';
  return input;
}

const api = { pages, pageOrder, fieldPaths, validateApplicant, buildInzWizard, DATE_PATTERN, stamp, t, hasTranslation, collectCopy, optionPresentation };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.INZForm = api;
