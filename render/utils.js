module.exports = {
  sendFileInfo,
  sendFileData,
  convertBytes,
  cancelTransferFile,
  cancelReceiveFile
}

// 100MB
const BUFFER_SIZE = 1024 * 1024 * 100;

function convertBytes(bytes) {
  if (bytes < 1024) {
    return bytes.toFixed(2) + " bytes";
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + " KB";
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  } else {
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }
}

/**
 * 1. 先发送文件头，弹出等待确认框（将文件信息保存到 socket）
 * 2. 对端弹出框，确认保存的位置，然后发送响应（将文件信息保存到 socket）
 * 3. 收到响应，如果确认，则切换成传输框。否则，清除文件信息
 * 4. 开始发送文件数据
 * 5. 对端收到文件数据，然后从 socket 中获取保存的文件信息，开始创建文件并保存
 */

function sendFileInfo(socket, path, fileName, callback) {
  socket.filePath = path;
  socket.fileSize = fs.statSync(path).size;
  // 先发送文件的元数据，使用JSON
  socket.write(JSON.stringify(
      {
        "id": "client2",
        "fileInfo": {"fileSize": socket.fileSize, "fileName": fileName}
      }), () => {
    if (callback) {
      callback();
    }
  });
}

function sendFileData(socket, open, data, end) {
  if (!socket.fileSize) {
    return;
  }
  let fileSize = socket.fileSize;
  let filePath = socket.filePath;
  let hadSend = 0;

  let readStream = fs.createReadStream(filePath);
  socket.readStream = readStream;
  readStream.on("open", function () {
    open(readStream, filePath, fileSize);
  });
  readStream.on("data", function (chunk) {
    socket.write(chunk);
    hadSend += chunk.length;
    data(hadSend, fileSize);
  });
  readStream.on("end", function () {
    end();
  });
}

function cancelTransferFile(socket) {
  if (!socket.fileSize) {
    return;
  }
  socket.readStream.close(); // 这可能不会关闭流。
  // 手动标记流的结束，就像底层的资源自身已表明文件的结束一样，使得流可以关闭。
  // 这不会取消待处理的读取操作，如果存在此类操作，则进程可能仍无法成功地退出，直到完成。
  // socket.readStream.push(null);
  socket.readStream.read(0);

  socket.filePath = null;
  socket.fileSize = null;
  socket.readStream = null;
}

function cancelReceiveFile(socket) {
  if (!socket.fileInfo) {
    return;
  }
  fs.closeSync(socket.fd);
  socket.fileInfo = null;
  // 已经接收的大小
  socket.hasSend = null;
  // 文件标识ID
  socket.fd = null;
}

function writeToFile(socket, data) {
  try {
    // 将文件信息绑定到当前socket，便于后续访问
    if (!socket.file_info) {
      let fileInfo = JSON.parse(data).fileInfo;
      // TODO 弹框，确认文件是否接收，以及是否另存为
      //  如果取消，则 return
      socket.file_info = file_info;
      // 已经接收的大小
      socket.hasSend = 0;
      // 文件标识ID
      socket.fd = fs.openSync(socket.file_info.fileName, "w+");
      // 反馈
      // socket.write("set file info");
    } else {
      socket.hasSend = socket.hasSend + data.length;
      fs.appendFileSync(socket.fd, data);
      console.log(
          (socket.hasSend / socket.file_info.fileSize * 100).toFixed(2) + "%");
      if (socket.hasSend >= socket.file_info.fileSize) {
        fs.closeSync(socket.fd);
        console.log("file transfer completed");
        // socket.write("file transfer completed");
        socket.file_info = null;
        socket.fd = null;
      }
    }
  } catch (e) {
    console.error(e);
  }
}
