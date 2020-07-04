module.exports = {
  getLocalHost,
  getLocalPort,
  getTargetHost,
  getTargetPort,
  getServerBtnText,
  getConnBtnText,
  switchServerBtn,
  switchConnBtn,
  startServerBtnOnClick,
  startConnBtnOnClick,
  //
  getPathName,
  sendBtnOnClick,
  //
  showProcess,
  hideProcess,
  //
  initProgress,
  cancelProgress,
  updateProgress,
  doneProgress,
  //
  showMsg,
  //
  showFileReceiveDialog
}
const utils = require("../render/utils.js");
//------------------------------------------------------------------------------
// 按钮切换
//------------------------------------------------------------------------------
let socketInfo = {
  init: false,
  localHost: null,
  localPort: null,
  startServerBtn: null,
  targetHost: null,
  targetPort: null,
  startConnBtn: null
};
function getSocketInfo() {
  if (!socketInfo.init) {
    socketInfo.localHost = $("#local_addr");
    socketInfo.localPort = $("#local_port");
    socketInfo.startServerBtn = $("#start_server_btn");
    socketInfo.targetHost = $("#target_addr");
    socketInfo.targetPort = $("#target_port");
    socketInfo.startConnBtn = $("#start_conn_btn");
    socketInfo.init = true;
  }
  return socketInfo;
}
function getLocalHost() {
  return getSocketInfo().localHost.val();
}
function getLocalPort() {
  return getSocketInfo().localPort.val();
}
function getTargetHost() {
  return getSocketInfo().targetHost.val();
}
function getTargetPort() {
  return getSocketInfo().targetPort.val();
}
function getServerBtnText() {
  return getSocketInfo().startServerBtn.text();
}
function getConnBtnText() {
  return getSocketInfo().startConnBtn.text();
}
function switchServerBtn(start) {
  if (start) {
    getSocketInfo().startServerBtn.removeClass("btn-danger");
    getSocketInfo().startServerBtn.addClass("btn-outline-primary");
    getSocketInfo().startServerBtn.text("启动");
    //
    getSocketInfo().startConnBtn.prop('disabled', false);
  } else {
    getSocketInfo().startServerBtn.removeClass("btn-outline-primary");
    getSocketInfo().startServerBtn.addClass("btn-danger");
    getSocketInfo().startServerBtn.text("关闭");
    // 关闭另外一个按钮
    getSocketInfo().startConnBtn.prop('disabled', true);
  }
}
function switchConnBtn(start) {
  if (start) {
    getSocketInfo().startConnBtn.removeClass("btn-danger");
    getSocketInfo().startConnBtn.addClass("btn-outline-primary");
    getSocketInfo().startConnBtn.text("连接");
    //
    getSocketInfo().startServerBtn.prop('disabled', false);
  } else {
    getSocketInfo().startConnBtn.removeClass("btn-outline-primary");
    getSocketInfo().startConnBtn.addClass("btn-danger");
    getSocketInfo().startConnBtn.text("断开");
    // 关闭另外一个按钮
    getSocketInfo().startServerBtn.prop('disabled', true);
  }
}
function startServerBtnOnClick(callback) {
  getSocketInfo().startServerBtn.click(callback);
}
function startConnBtnOnClick(callback) {
  getSocketInfo().startConnBtn.click(callback);
}
//------------------------------------------------------------------------------
// 文件拖动和发送
//------------------------------------------------------------------------------
let fileInput = {
  init: false,
  dropArea: null,
  sendText: null,
  sendBtn: null
};
function getFileInput() {
  if (!fileInput.init) {
    fileInput.dropArea = document.getElementById("drop_area");
    fileInput.sendText = $("#drop_area #file_input_text");
    fileInput.sendBtn = $("#drop_area #file_input_btn");
    fileInput.init = true;
    initFileInput(fileInput);
  }
  return fileInput;
}
function initFileInput(fileInput) {
  // 拖动处理
  fileInput.dropArea.addEventListener("drop", (e) => {
    // 阻止浏览器的默认拖入行为
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length >= 1) {
      const path = files[0].path;
      getFileInput().sendText.val(path);
    }
  })
  // 阻止浏览器的默认拖出行为
  fileInput.dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
  })
}
function getPathName() {
  return getFileInput().sendText.val();
}
function sendBtnOnClick(callback) {
  getFileInput().sendBtn.click(callback);
}
//------------------------------------------------------------------------------
// 正在处理
//------------------------------------------------------------------------------
let processing = {
  init: false,
  processing: null,
  processingMsg: null
};
function getProcessing() {
  if (!processing.init) {
    processing.processing = $("#processing");
    processing.processingMsg = $("#processing #processing-msg");
    processing.init = true;
  }
  return processing;
}
function showProcess(msg) {
  if (msg) {
    getProcessing().processingMsg.text(msg);
  }
  getProcessing().processing.modal("show");
}
function hideProcess() {
  getProcessing().processing.modal("hide");
}
//------------------------------------------------------------------------------
// 进度条模块
//------------------------------------------------------------------------------
let progress = {
  init: false,
  progress: null,
  progressFileName: null,
  progressFileSize: null,
  status: null,
  progressBar: null,
  cancelTransfer: null
};
function getProgress() {
  if (!progress.init) {
    progress.progress = $("#progress");
    progress.progressFileName = $("#progress #fileName");
    progress.progressFileSize = $("#progress #fileSize");
    progress.status = $("#progress #status");
    progress.progressBar = $("#progress .progress-bar");
    progress.cancelTransfer = $("#progress .close");
    progress.init = true;
  }
  return progress;
}
function initProgress(pathName, fileName, fileSize, status, cancelCallback) {
  getProgress().status.text(status);
  getProgress().progressFileName.attr("title", pathName);
  getProgress().progressFileName.text(fileName);
  getProgress().progressFileSize.text(fileSize);
  getProgress().progressBar.addClass("progress-bar-striped");
  getProgress().progressBar.removeClass("bg-danger");
  getProgress().progressBar.width("0%");
  getProgress().progressBar.text("0%");
  getProgress().progress.show();

  getProgress().cancelTransfer.show();
  // 取消 click 事件，防止重复注册
  getProgress().cancelTransfer.off("click");
  getProgress().cancelTransfer.on("click", () => {
    cancelCallback();
  });
}
function cancelProgress() {
  getProgress().progressBar.removeClass("progress-bar-striped");
  getProgress().progressBar.addClass("bg-danger");
  getProgress().cancelTransfer.hide();
}
function updateProgress(value) {
  // 取消小数点，每 1% 才更新一次，减少进度条的更新频次
  let percent = (value * 100).toFixed(0) + "%";
  if (getProgress().progressBar.text() === percent) {
    return;
  }
  getProgress().progressBar.width(percent);
  getProgress().progressBar.text(percent);
}
function doneProgress() {
  getProgress().cancelTransfer.hide();
  getProgress().progressBar.removeClass("progress-bar-striped");
}
//------------------------------------------------------------------------------
// 弹框提示
//------------------------------------------------------------------------------
let msgDialog = {
  init: false,
  msgDialog: null,
  title: null,
  body: null
};
function getMsgDialog() {
  if (!msgDialog.init) {
    msgDialog.msgDialog = $("#wrongMsgModel");
    msgDialog.title = $("#wrongMsgModel .modal-title");
    msgDialog.body = $("#wrongMsgModel .modal-body");
    msgDialog.init = true;
  }
  return msgDialog;
}
function showMsg(title, msg) {
  getMsgDialog().title.text(title);
  getMsgDialog().body.text(msg);
  getMsgDialog().msgDialog.modal("show");
}
//------------------------------------------------------------------------------
// 弹框提示
//------------------------------------------------------------------------------
let fileConfirm = {
  init: false,
  fileConfirm: null,
  body: null,
  ackBtn: null,
  cancelBtn: null
};
function getFileConfirm() {
  if (!fileConfirm.init) {
    fileConfirm.fileConfirm = $("#saveFileModal");
    fileConfirm.body = $("#saveFileModal .modal-body");
    fileConfirm.ackBtn = $("#saveFileModal .btn-primary");
    fileConfirm.cancelBtn = $("#saveFileModal .btn-secondary");
    fileConfirm.init = true;
  }
  return fileConfirm;
}
function showFileReceiveDialog(dialog, fileInfo, callback) {
  let fileName = fileInfo.fileName;
  // 弹框确认
  getFileConfirm().body.text(
      fileName + " (" + utils.convertBytes(fileInfo.fileSize) + ")");
  getFileConfirm().fileConfirm.modal("show");

  // 取消 click 事件，防止重复注册
  getFileConfirm().ackBtn.off("click");
  getFileConfirm().cancelBtn.off("click");
  getFileConfirm().ackBtn.click(() => {
    // 弹出另存为
    let pathName = dialog.showSaveDialogSync({defaultPath: fileName});
    callback(pathName);
  });
  getFileConfirm().cancelBtn.click(() => {
    callback(undefined);
  });
}
//------------------------------------------------------------------------------