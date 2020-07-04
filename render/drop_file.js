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
  if (currentConn == null) {
    view.showMsg("错误", "请先建立连接！");
    return;
  }
  // TODO 如果正在接收，则取消发送
  if (currentConn.recvFileInfo) {
    view.showMsg("错误", "请等待文件接收完成！");
    return;
  }
  if (!fs.existsSync(pathName)) {
    view.showMsg("错误", "文件或目录不存在！");
    return;
  }
  let fileName = path.basename(pathName);
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
          console.log("连接成功");
        });
    // 错误处理
    currentConn.on("error", (err) => {
      console.error(err);
      view.showMsg("错误", err.message);
    });
    // 数据接收处理
    currentConn.on("data", function (data) {
      processData(currentConn, data);
    });
    // 关闭客户端连接
    currentConn.on("close", function (data) {
      console.log("连接断开: " + data);
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
    console.log("服务端启动：" + host + ":" + port);
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
  console.log("客户端接入: " + client.remoteAddress + ": " + client.remotePort);

  client.on("data", (data) => {
    processData(client, data);
  });
  // TCP 的半关闭状态可能会有数据
  client.on("close", (data) => {
    console.log("客户端断开: " + client.remoteAddress + ": " + client.remotePort);
  });
}

function processData(socket, data) {
  try {
    if (data.length === 1) {
      processCommand(socket, data);
      return;
    }
    processFileRecv(socket, data);
  } catch (e) {
    // 处理数据时如果出错，不结束进程
    console.error(e);
  }
}

function processFileRecv(socket, data) {
  // 将文件信息绑定到当前socket，便于后续访问
  if (!socket.recvFileInfo) {
    let fileInfo = JSON.parse(data).fileInfo;
    view.showFileReceiveDialog(dialog, fileInfo, (pathName) => {
      if (!pathName) {
        console.log("取消文件接收");
        socket.write("0");
        return;
      }
      console.log("接收文件：", pathName);
      let recvFileInfo = {
        filePath: null,
        fileName: null,
        fileSize: null,
        hasRecv: null,
        fd: null
      };
      socket.recvFileInfo = recvFileInfo;
      let fileName = path.basename(pathName);
      recvFileInfo.filePath = pathName;
      recvFileInfo.fileName = fileName;
      recvFileInfo.fileSize = fileInfo.fileSize;
      // 已经接收的大小
      recvFileInfo.hasRecv = 0;
      // 文件标识ID
      recvFileInfo.fd = fs.openSync(recvFileInfo.filePath, "w+");
      // 反馈
      socket.write("1");
      view.initProgress(pathName, fileName,
          utils.convertBytes(recvFileInfo.fileSize), '接收', () => {
            // 接收方主动取消，要先等发送方结束发送
            currentConn.write("2");
          });
    });
  } else {
    let recvFileInfo = socket.recvFileInfo;
    recvFileInfo.hasRecv = recvFileInfo.hasRecv + data.length;
    fs.appendFileSync(recvFileInfo.fd, data);
    view.updateProgress(recvFileInfo.hasRecv / recvFileInfo.fileSize);
    if (recvFileInfo.hasRecv >= recvFileInfo.fileSize) {
      // 文件接收完成
      console.log("文件接收完成");
      utils.closeReceiveFile(socket);
      view.doneProgress();
    }
  }
}

function processCommand(socket, data) {
  let msg = data.toString();
  if (msg === "0") {
    // TODO 如果发送方取消
    // 对方已取消
    console.log("取消文件发送");
    view.hideProcess();
    view.showMsg("提示", "对方已取消");
    utils.closeTransferFile(socket);
    return;
  }
  if (msg === "2") {
    try {
      // 对方已中断
      console.log("中断文件发送");
      if (socket.sendFileInfo) {
        // 如果是发送方，需要响应
        utils.closeTransferFile(socket);
        socket.write("2");
      } else if (socket.recvFileInfo) {
        // 如果是接收方
        utils.closeReceiveFile(socket);
      } else {
        return;
      }
      view.cancelProgress();
    } catch (e) {
      console.error(e);
    }
    return;
  }
  if (msg === "1") {
    // 对方已确认
    view.hideProcess();
    utils.sendFileData(socket, (readStream, filePath, fileSize) => {
      let fileName = path.basename(filePath);
      view.initProgress(filePath, fileName, utils.convertBytes(fileSize), '发送',
          () => {
            // 发送方主动取消，同时接收方，不需要响应，直接销毁
            console.log("中断文件发送");
            currentConn.write("2");
            utils.closeTransferFile(socket);
            view.cancelProgress();
          });
    }, (hadSend, fileSize) => {
      // 更新进度条
      view.updateProgress(hadSend / fileSize);
    }, () => {
      // 完成进度条
      console.log("文件发送完成");
      view.doneProgress();
      utils.closeTransferFile(socket);
    });
  }
}