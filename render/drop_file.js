window.$ = window.jQuery = require("jquery");
const utils = require("../render/utils.js");
const {dialog, shell, nativeImage} = require("electron").remote;
const fs = require("fs");
const net = require("net");
const path = require("path");

const local_addr = $("#local_addr");
const local_port = $("#local_port");
const start_server_btn = $("#start_server_btn");

const target_addr = $("#target_addr");
const target_port = $("#target_port");
const start_conn_btn = $("#start_conn_btn");

const drop_area = document.getElementById("drop_area");
// const drop_area = $("#drop_area");
const file_input_text = $("#file_input_text");
const file_input_btn = $("#file_input_btn");

function getPathName() {
  return file_input_text.val();
}

function setPathName(path) {
  file_input_text.val(path);
}

/**
 * 1. 服务器只接受一个客户端连接，关闭服务器后，客户端的连接并没有断开
 *  解决了：server接入的client被外部的conn引用了，导致server关闭不了，但外面又粗暴地赋值null，导致不统一
 * 2. 既然只处理一个连接，那么全局只保存一个 connection，这样发送的时候就不需要选择了
 */
function sendDirSync(path, size) {
  // 对于没有权限的路径，会阻塞并且抛异常
  let files = fs.readdirSync(path);
  if (files.length === 0) {
    // Empty directory
  }
  let dirSize = 0;
  files.forEach(function (file, index) {
    let absolutePath = path + "/" + file;
    let info = fs.statSync(absolutePath)
    if (info.isDirectory()) {
      // console.log("dir: " + absolutePath)
      dirSize += sendDirSync(absolutePath, size);
    } else {
      // (/1024).toFixed(2) + " kb"
      let fileSize = info.size;
      dirSize += fileSize;
      // console.log("file: " + absolutePath + " " + fileSize);
    }
  })
  return dirSize;
}

// 拖动处理
drop_area.addEventListener("drop", (e) => {
  // 阻止浏览器的默认拖入行为
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files && files.length >= 1) {
    const path = files[0].path;
    setPathName(path);
  }
})

// 阻止浏览器的默认拖出行为
drop_area.addEventListener("dragover", (e) => {
  e.preventDefault();
})

// 发送按钮点击
file_input_btn.click(() => {
  let pathName = getPathName();
  console.log(pathName);
  if (currentConn == null) {
    show_msg("错误", "请先建立连接！");
    return;
  }
  if (!fs.existsSync(pathName)) {
    show_msg("错误", "文件或目录不存在！");
    return;
  }
  let fileName = path.basename(pathName);
  console.log(fileName);
  utils.sendFileInfo(currentConn, pathName, fileName, () => {
    show_process("等待对方确认");
  });
  // let size = sendDirSync(pathName);
  // console.log("size: " + size);
  // console.log("size: " + convertBytes(size));
})

let server = null;
// 启动服务器
start_server_btn.click(() => {
  let btn_text = start_server_btn.text();
  if (btn_text === "启动") {
    if (server != null && server.listening) {
      switch_server_btn(false);
      console.warn("服务器已启动，请勿重复操作!");
      return;
    }
    server = start_server(local_addr.val(), local_port.val());
  } else if (btn_text === "关闭") {
    if (server == null || !server.listening) {
      switch_server_btn(true);
      console.warn("服务器已关闭，请勿重复操作!");
      return;
    }
    server.close();
    server = null;
    if (currentConn != null) {
      currentConn.destroy();
      currentConn = null;
    }
  }
})
let currentConn = null;
// 客户端连接
start_conn_btn.click(() => {
  let btn_text = start_conn_btn.text();
  if (btn_text === "连接") {
    currentConn = net.createConnection(target_port.val(), target_addr.val(),
        () => {
          switch_conn_btn(false);
        });
    console.log(currentConn);
    // 错误处理
    currentConn.on("error", (err) => {
      console.error(err);
      show_msg("错误", err.message);
    });
    // 数据接收处理
    currentConn.on("data", function (data) {
      console.log(data);
      if (data.length === 1) {
        let msg = data.toString();
        if (msg === "0") {
          // 对方已取消
          console.log("对方已取消");
          hide_process();
          show_msg("提示", "对方已取消");
        } else if (msg === "2") {
          // 对方已取消
          utils.cancelTransferFile(currentConn);
          cancel_progress();
        } else if (msg === "1") {
          // 对方已确认
          console.log("对方已确认");
          hide_process();
          utils.sendFileData(currentConn, (readStream, filePath, fileSize) => {
            let fileName = path.basename(filePath);
            init_progress(filePath, fileName, utils.convertBytes(fileSize),
                () => {
                  // TODO 使用工具来解析命令，枚举、常量、以及配套的解析方法
                  currentConn.write("2");
                  utils.cancelTransferFile(currentConn);
                  cancel_progress();
                });
          }, (hadSend, fileSize) => {
            update_progress(hadSend / fileSize);
          }, () => {
            done_progress();
          });
        }
      } else {
      }
    });
    // 关闭客户端连接
    currentConn.on("close", function (data) {
      console.log("close: " + data);
      switch_conn_btn(true);
      currentConn = null;
    });
  } else if (btn_text === "断开") {
    if (currentConn != null) {
      currentConn.destroy();
    }
  }
})

// 启动服务端
function start_server(host, port) {
  let tcp_server = net.createServer(accept);
  tcp_server.on("error", (err) => {
    console.error(err);
    show_msg("错误", err.message);
  });
  tcp_server.listen(port, host, () => {
    console.log("Server listening on " + host + ":" + port);
    switch_server_btn(false);
  });
  tcp_server.on("close", () => {
    switch_server_btn(true);
    console.log("关闭服务器");
  })
  return tcp_server;
}

function accept(client) {
  // 客户端接入
  currentConn = client;
  console.log(client);
  console.log("Accept: " + client.remoteAddress + ": " + client.remotePort);

  client.on("data", (data) => {
    writeToFile(client, data);
  });
  // TCP 的半关闭状态可能会有数据
  client.on("close", (data) => {
    console.log("Closed: " + client.remoteAddress + ": " + client.remotePort);
  });
}

function writeToFile(socket, data) {
  try {
    if (data.length === 1) {
      let msg = data.toString();
      if (msg === "2") {
        utils.cancelReceiveFile(currentConn);
        cancel_progress();
      }
      return;
    }
    // 将文件信息绑定到当前socket，便于后续访问
    if (!socket.fileInfo) {
      let fileInfo = JSON.parse(data).fileInfo;
      receive_file_ack(fileInfo, (pathName) => {
        if (!pathName) {
          socket.write("0");
          return;
        }
        socket.fileInfo = fileInfo;
        // 已经接收的大小
        socket.hasSend = 0;
        // 文件标识ID
        socket.fd = fs.openSync(pathName, "w+");
        // 反馈
        socket.write("1");
        let fileName = path.basename(pathName);
        init_progress(pathName, fileName,
            utils.convertBytes(fileInfo.fileSize), () => {
              currentConn.write("2");
              utils.cancelReceiveFile(currentConn);
              cancel_progress();
            });
      });
    } else {
      socket.hasSend = socket.hasSend + data.length;
      fs.appendFileSync(socket.fd, data);
      // console.log(
      //     (socket.hasSend / socket.fileInfo.fileSize * 100).toFixed(2) + "%");
      update_progress(socket.hasSend / socket.fileInfo.fileSize);
      if (socket.hasSend >= socket.fileInfo.fileSize) {
        fs.closeSync(socket.fd);
        console.log("file transfer completed");
        // socket.write("file transfer completed");
        socket.fileInfo = null;
        socket.fd = null;
        done_progress();
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// 切换启动/关闭服务端按钮
function switch_server_btn(start) {
  if (start) {
    start_server_btn.removeClass("btn-danger");
    start_server_btn.addClass("btn-outline-primary");
    start_server_btn.text("启动");
  } else {
    start_server_btn.removeClass("btn-outline-primary");
    start_server_btn.addClass("btn-danger");
    start_server_btn.text("关闭");
  }
}

function switch_conn_btn(start) {
  if (start) {
    start_conn_btn.removeClass("btn-danger");
    start_conn_btn.addClass("btn-outline-primary");
    start_conn_btn.text("连接");
  } else {
    start_conn_btn.removeClass("btn-outline-primary");
    start_conn_btn.addClass("btn-danger");
    start_conn_btn.text("断开");
  }
}

// 提示信息
function show_msg(title, msg) {
  $("#wrongMsgModel .modal-title").text(title);
  $("#wrongMsgModel .modal-body").text(msg);
  $("#wrongMsgModel").modal("show");
}

// 确认接收文件
function receive_file_ack(fileInfo, callback) {
  let fileName = fileInfo.fileName;
  // 弹框确认
  $("#saveFileModal .modal-body").text(
      fileName + " (" + utils.convertBytes(fileInfo.fileSize) + ")");
  $("#saveFileModal").modal("show");
  let ackBtn = $("#saveFileModal .btn-primary");
  let canceledBtn = $("#saveFileModal .btn-secondary");
  // 取消 click 事件，防止重复注册
  ackBtn.off("click");
  canceledBtn.off("click");
  ackBtn.click(() => {
    // 弹出另存为
    let pathName = dialog.showSaveDialogSync({defaultPath: fileName});
    callback(pathName);
  });
  canceledBtn.click(() => {
    callback(undefined);
  });
}

let processing = $("#processing");
let processingBody = $("#processing .modal-body");

// 正在处理
function show_process(msg) {
  if (msg) {
    processingBody.text(msg);
  }
  processing.modal("show");
}

function hide_process() {
  processing.modal("hide");
}

let progress = $("#progress");
let progressFileName = $("#progress #fileName");
let progressFileSize = $("#progress #fileSize");
let progressBar = $("#progress .progress-bar");

let cancelTransfer = $("#progress .close");

// TODO 将进度条等做成组件，根据事件类型来切换状态
function init_progress(pathName, fileName, fileSize, cancelCallback) {
  progressFileName.attr("title", pathName);
  progressFileName.text(fileName);
  progressFileSize.text(fileSize);
  progressBar.addClass("progress-bar-striped");
  progressBar.removeClass("bg-danger");
  progressBar.width("0%");
  progressBar.text("0%");
  progress.show();

  init_cancel_transfer(cancelCallback);
}

function init_cancel_transfer(cancelCallback) {
  cancelTransfer.show();
  // 取消 click 事件，防止重复注册
  cancelTransfer.off("click");
  cancelTransfer.on("click", () => {
    cancelCallback();
  });
}

function cancel_progress() {
  progressBar.removeClass("progress-bar-striped");
  progressBar.addClass("bg-danger");
  cancelTransfer.hide();
}

// TODO 减少进度条的更新频次
function update_progress(value) {
  let percent = (value * 100).toFixed(0) + "%";
  if (progressBar.text() === percent) {
    return;
  }
  progressBar.width(percent);
  progressBar.text(percent);
}

function done_progress() {
  progressBar.removeClass("progress-bar-striped");
}

function hide_progress() {
  progress.hide();
}
