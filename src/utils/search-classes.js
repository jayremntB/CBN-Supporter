'use strict'
const sendResponse = require('../general/sendResponse');
const stuff = require('../general/stuff');

const dbName = 'database-for-cbner';

module.exports = {
  init: init,
  handleMessage: handleMessage
};

function init(client, sender_psid, userData) {
  createBlock(client, sender_psid);
  const response = stuff.searchClassesAskTeacher;
  sendResponse(sender_psid, response);
}

function handleMessage(client, sender_psid, text, userData) {
  if(text.toLowerCase() === 'danh sách giáo viên') {
    const response = stuff.teacherList;
    sendResponse(sender_psid, response);
  }
  else if(text.toLowerCase() === "giáo viên khác") {
    const response = stuff.searchClassesAskTeacher;
    clearData(client, sender_psid);
    sendResponse(sender_psid, response);
  }
  else if(userData.search_classes.teacher) {
    sendClasses(sender_psid, text, userData);
  }
  else if(checkTeacherName(sender_psid, text)) {
    updateData(client, sender_psid, text);
  }
}

function createBlock(client, sender_psid) {
  const collectionUserData = client.db(dbName).collection('users-data');
  let response = {
    "text": "Úi, tớ không kết nối với database được. Cậu hãy thử lại sau nha T.T"
  };
  collectionUserData.updateOne({ sender_psid: sender_psid }, {
    $set: {
      search_classes: {
        block: true,
        teacher: "",
        teaches: []
      }
    }
  }, (err) => {
    if(err) {
      console.error(err);
      sendResponse(sender_psid, response);
    }
    else console.log('init search block successfully');
  });
}

function clearData(client, sender_psid) {
  client.db(dbName).collection('users-data').updateOne({ sender_psid: sender_psid }, {
    $set: {
      search_classes: {
        block: true,
        teacher: "",
        teaches: []
      }
    }
  }, (err) => {
    if(err) {
      let response = {
        "text": "Úi, tớ không kết nối với database được. Cậu hãy thử lại sau nha T.T"
      };
      console.log("Could not clear other group data");
      sendResponse(sender_psid, response);
    } else {
      console.log("clear other group data successfully");
    }
  });
}

function updateData(client, sender_psid, teacherName) {
  let response = {
    "text": ""
  }
  client.db(dbName).collection('schedule').find({
    $or: [
      {"schedule.morning.teacher": teacherName},
      {"schedule.afternoon.teacher": teacherName}
    ]
  }).toArray((err, docs) => {
    if(err) console.log(err);
    else if(docs) {
      let teaches = [];
      for(let i = 0; i < 6; i ++) { // loop days
        teaches.push({
          "morning": [],
          "afternoon": []
        });
        for(let j = 0; j < 5; j ++) { // loop classes
          // loop groups
          docs.forEach((doc) => {
            if(doc.schedule[i].morning[j] && doc.schedule[i].morning[j].teacher === teacherName){
              teaches[i].morning.push({
                class: j + 1,
                group: doc.group
              });
              return; // If found, immediately return cause teacher teaches one class per group
            }
          });
          docs.forEach((doc) => {
            if(doc.schedule[i].afternoon[j] && doc.schedule[i].afternoon[j].teacher === teacherName){
              teaches[i].afternoon.push({
                class: j + 1,
                group: doc.group
              });
              return;
            }
          });
        }
      }
      client.db(dbName).collection('users-data').updateOne({ sender_psid: sender_psid }, {
        $set: {
          search_classes: {
            block: true,
            teacher: teacherName,
            teaches: teaches
          }
        }
      }, (err) => {
        if (err) {
          const response = {
            "text": "Úi, tớ không kết nối với database được. Cậu hãy thử lại sau nha T.T"
          };
          console.error("Could not update teaches data: \n" + err);
          sendResponse(sender_psid, response);
        } else {
          console.log("Update teaches data successfully!");
          let response = stuff.askDay;
          response.quick_replies[0].title = "Giáo viên khác";
          response.quick_replies[0].payload = "overwriteTeacher";
          response.text = `Cập nhật lịch dạy của giáo viên ${teacherName} thành công!\nCậu muốn tìm lịch dạy vào thứ mấy?`;
          sendResponse(sender_psid, response);
        }
      });
    }
    else {
      response = stuff.checkTeacherNameResponse;
      response.text = `Tuần này giáo viên ${teacherName} không có buổi dạy nào :(`;
      sendResponse(sender_psid, response);
    }
  });
}

function sendClasses(sender_psid, dayInput, userData) {
  let response = stuff.askDay;
  response.quick_replies[0].title = "Giáo viên khác";
  response.quick_replies[0].payload = "overwriteTeacher";
  let day = handleDayInput(dayInput.toLowerCase());
  // Check if we are in search_schedule_other_group block or not, and send the suitable data
  let teaches = userData.search_classes.teaches;
  if(day === "Tất cả") {
    let text = `Lịch dạy tuần này của giáo viên ${userData.search_classes.teacher}: `;
    teaches.forEach((data, days) => {
      text += `
* Thứ ${days + 2}:
 - Sáng: `;
      if(data.morning.length === 0) text += "Trống";
      else {
        data.morning.forEach((subdata) => {
          text += `
   + Tiết ${subdata.class}: ${subdata.group}`;
        });
      }
      //    ------------------------
      text += `
 - Chiều: `;
      //
      if(data.afternoon.length === 0) text += "Trống";
      else {
        data.afternoon.forEach((subdata) => {
          text += `
   + Tiết ${subdata.class}: ${subdata.group}`;
        });
      }
      //    ------------------------
      text += `\n-----------`;
    });
    text += `\nVì Tổ quốc xã hội chủ nghĩa. Vì lý tưởng của Bác Hồ vĩ đại: Sẵn sàng!`;
    response.text = text;
    sendResponse(sender_psid, response);
  }
  else if(!isNaN(day)){
    if(day == 8) {
      response.text = "Ngày này thì ai chẳng ở nhà bận yêu gia đình :(";
      sendResponse(sender_psid, response);
    }
    else if(day - 1 > teaches.length || day - 2 < 0) {
      response.text = `Nàooo -__- Đừng điền vớ vẩn .-.`;
      sendResponse(sender_psid, response);
    }
    else {
      const data = teaches[day - 2];
      let text = `Lịch dạy thứ ${day}:
 - Sáng: `;
      if(data.morning.length === 0) text += "Trống";
      else {
        data.morning.forEach((subdata) => {
          text += `
   + Tiết ${subdata.class}: ${subdata.group}`;
        });
      }
      //    ------------------------
      text += `
 - Chiều: `;
      //
      if(data.afternoon.length === 0) text += "Trống";
      else {
        data.afternoon.forEach((subdata) => {
          text += `
   + Tiết ${subdata.class}: ${subdata.group}`;
        });
      }
      text += `\n-----------\nVì Tổ quốc xã hội chủ nghĩa. Vì lý tưởng của Bác Hồ vĩ đại: Sẵn sàng!`;
      response.text = text;
      sendResponse(sender_psid, response);
    }
  }
  else {
    response.text = `Nàooo -__- Đừng nhắn gì ngoài mấy cái hiện lên bên dưới .-.`;
    sendResponse(sender_psid, response);
  }
}

function checkTeacherName(sender_psid, teacherName) {
  const checkArray = [
    'PN.An',       'NT.Bình',  'NV.Bảo',    'PT.Bằng',    'NV.Bình',
    'NTT.Dung',    'NT.Dịu',   'NT.Dung',   'LT.Giang',   'NT.Giang',
    'NTT.Huyền',   'HT.Hà',    'VT.Huyến',  'NK.Hoàn',    'NT.Hương',
    'BT.Hưng',     'ĐT.Hường', 'NT.Huế',    'ĐT.Hương',   'NT.Hà(h)',
    'VTT.Hằng',    'HL.Hương', 'ĐT.Hiền',   'NT.Hường',   'NT.Hà(su)',
    'NT.Hòa',      'LTT.Hiền', 'PĐ.Hiệp',   'VT.Huê',     'NT.Hoa',
    'VB.Huy',      'LN.Hân',   'TV.Kỷ',     'NH.Khánh',   'TT.Khanh',
    'TK.Linh',     'LT.Loan',  'NT.Linh',   'VT.Len',     'ND.Liễu',
    'NTM.Loan',    'NT.Loan',  'NTH.Liên',  'NT.Lê',      'NT.Lệ',
    'VT.Lợi',      'NM.Lan',   'NP.Ly Ly',  'LT.Mùi',     'NQ.Minh',
    'NV.Mạnh',     'NT.Nga',   'TB.Ngọc',   'TTB.Ngọc',   'NT.Nhung',
    'HT.Nhân',     'LV.Ngân',  'NP.Nga',    'DTT.Nga',    'NV.Nga',
    'NT.Nguyệt',   'HD.Ngọc',  'NTT.Nhung', 'NV.Phán',    'NTT.Phương',
    'TH.Quang',    'NV.Tuấn',  'HT.Thảo',   'TT.Trang',   'NTH.Trang',
    'NT.Thu',      'HTT.Thủy', 'NTT.Thuỷ',  'LH.Trang',   'PH.Trang',
    'NTP.Thảo',    'NT.Tuyết', 'CT.Thúy',   'NP.Thảo',    'NC.Trung',
    'BM.Thủy',     'ĐTT.Toàn', 'NH.Vân',    'PH.Vân',     'NT.Vân',
    'TTB.Vân',     'NĐ.Vang',  'TH.Xuân',   'NT.Yến (đ)', 'TT.Yến',
    'NT.Yến (nn)', 'HTN.Ánh',  'TN.Điệp',   'LĐ.Điển',    'NT.Đức'
  ];
  if(checkArray.includes(teacherName)) return true;
  else {
    let response = stuff.checkTeacherNameResponse;
    sendResponse(sender_psid, response);
    return false;
  }
}

function handleDayInput(day) {
  const date = new Date();
  date.setHours(date.getHours() + 7); // App is deployed in heroku US
  let dayNow = Number(date.getDay()) + 1;
  switch (day) {
    case 'tất cả':
      return 'Tất cả';
      break;
    case 'hôm nay':
      return dayNow;
      break;
    case 'hôm qua':
      if(dayNow === 2) return 8;
      if(dayNow === 1) return 7;
      dayNow --;
      return dayNow;
      break;
    case 'ngày mai':
      dayNow ++;
      return dayNow;
      break;
    case 'chủ nhật':
      return 8;
      break;
    default:
      return day;
  }
}