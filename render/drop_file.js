window.$ = window.jQuery = require("jquery");
const utils = require("../render/utils.js");
const view = require("../render/view.js");
const {dialog} = require("electron").remote;
const fs = require("fs");
const net = require("net");
const path = require("path");

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

// 发送按钮点击
view.sendBtnOnClick(() => {
  let pathName = view.getPathName();
  console.log(pathName);
  if (currentConn == null) {
    view.showMsg("错误", "请先建立连接！");
    return;
  }
  if (!fs.existsSync(pathName)) {
    view.showMsg("错误", "文件或目录不存在！");
    return;
  }
  let fileName = path.basename(pathName);
  console.log(fileName);
  utils.sendFileInfo(currentConn, pathName, fileName, () => {
    view.showProcess("等待对方确认");
  });
  // let size = sendDirSync(pathName);
  // console.log("size: " + size);
  // console.log("size: " + convertBytes(size));
})

let server = null;
// 启动服务器
view.startServerBtnOnClick(() => {
  let btnText = view.getServerBtnText();
  if (btnText === "启动") {
    if (server != null && server.listening) {
      view.switchServerBtn(false);
      console.warn("服务器已启动，请勿重复操作!");
      return;
    }
    server = startServer(view.getLocalHost(), view.getLocalPort());
  } else if (btnText === "关闭") {
    if (server == null || !server.listening) {
      view.switchServerBtn(true);
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
view.startConnBtnOnClick(() => {
  let btnText = view.getConnBtnText();
  if (btnText === "连接") {
    currentConn = net.createConnection(view.getTargetPort(),
        view.getTargetHost(),
        () => {
          view.switchConnBtn(false);
        });
    console.log(currentConn);
    // 错误处理
    currentConn.on("error", (err) => {
      console.error(err);
      view.showMsg("错误", err.message);
    });
    // 数据接收处理
    currentConn.on("data", function (data) {
      // console.log(data);
      if (data.length === 1) {
        let msg = data.toString();
        if (msg === "0") {
          // 对方已取消
          console.log("对方已取消");
          view.hideProcess();
          view.showMsg("提示", "对方已取消");
        } else if (msg === "2") {
          // 对方已中断
          utils.cancelTransferFile(currentConn);
          view.cancelProgress();
        } else if (msg === "1") {
          // TODO 如果正在发送，则取消响应
          // 对方已确认
          console.log("对方已确认");
          view.hideProcess();
          utils.sendFileData(currentConn, (readStream, filePath, fileSize) => {
            let fileName = path.basename(filePath);
            view.initProgress(filePath, fileName, utils.convertBytes(fileSize),
                () => {
                  // TODO 使用工具来解析命令，枚举、常量、以及配套的解析方法
                  currentConn.write("2");
                  utils.cancelTransferFile(currentConn);
                  view.cancelProgress();
                });
          }, (hadSend, fileSize) => {
            view.updateProgress(hadSend / fileSize);
          }, () => {
            view.doneProgress();
          });
        }
      } else {

      }
    });
    // 关闭客户端连接
    currentConn.on("close", function (data) {
      console.log("close: " + data);
      view.switchConnBtn(true);
      currentConn = null;
    });
  } else if (btnText === "断开") {
    if (currentConn != null) {
      currentConn.destroy();
    }
  }
})

// 启动服务端
function startServer(host, port) {
  let tcp_server = net.createServer(accept);
  tcp_server.on("error", (err) => {
    console.error(err);
    view.showMsg("错误", err.message);
  });
  tcp_server.listen(port, host, () => {
    console.log("Server listening on " + host + ":" + port);
    view.switchServerBtn(false);
  });
  tcp_server.on("close", () => {
    view.switchServerBtn(true);
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
    processData(client, data);
  });
  // TCP 的半关闭状态可能会有数据
  client.on("close", (data) => {
    console.log("Closed: " + client.remoteAddress + ": " + client.remotePort);
  });
}

function processData(socket, data) {
  try {
    if (data.length === 1) {
      let msg = data.toString();
      if (msg === "2") {
        // 对方已中断
        utils.cancelReceiveFile(currentConn);
        view.cancelProgress();
      }
      return;
    }
    // 将文件信息绑定到当前socket，便于后续访问
    if (!socket.fileInfo) {
      let fileInfo = JSON.parse(data).fileInfo;
      view.showFileReceiveDialog(dialog, fileInfo, (pathName) => {
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
        view.initProgress(pathName, fileName,
            utils.convertBytes(fileInfo.fileSize), () => {
              currentConn.write("2");
              utils.cancelReceiveFile(currentConn);
              view.cancelProgress();
            });
      });
    } else {
      socket.hasSend = socket.hasSend + data.length;
      fs.appendFileSync(socket.fd, data);
      // console.log(
      //     (socket.hasSend / socket.fileInfo.fileSize * 100).toFixed(2) + "%");
      view.updateProgress(socket.hasSend / socket.fileInfo.fileSize);
      if (socket.hasSend >= socket.fileInfo.fileSize) {
        fs.closeSync(socket.fd);
        console.log("file transfer completed");
        // socket.write("file transfer completed");
        socket.fileInfo = null;
        socket.fd = null;
        view.doneProgress();
      }
    }
  } catch (e) {
    console.error(e);
  }
}