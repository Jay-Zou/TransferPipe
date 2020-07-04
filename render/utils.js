module.exports = {
  sendFileInfo,
  sendFileData,
  convertBytes,
  closeTransferFile,
  closeReceiveFile
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
  let sendFileInfo = {
    filePath: null,
    fileName: null,
    fileSize: null,
    readStream: null
  };
  sendFileInfo.filePath = path;
  sendFileInfo.fileName = fileName;
  sendFileInfo.fileSize = fs.statSync(path).size;
  socket.sendFileInfo = sendFileInfo;
  // 先发送文件的元数据，使用JSON
  socket.write(JSON.stringify(
      {
        "id": "client2",
        "fileInfo": {
          "fileSize": sendFileInfo.fileSize,
          "fileName": sendFileInfo.fileName
        }
      }), () => {
    if (callback) {
      callback();
    }
  });
}

function sendFileData(socket, open, data, end) {
  if (!socket.sendFileInfo) {
    return;
  }
  let fileSize = socket.sendFileInfo.fileSize;
  let filePath = socket.sendFileInfo.filePath;
  let hadSend = 0;
  let readStream = fs.createReadStream(filePath);
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
  socket.sendFileInfo.readStream = readStream;
}

function closeTransferFile(socket) {
  if (!socket.sendFileInfo) {
    return;
  }
  if (socket.sendFileInfo.readStream) {
    socket.sendFileInfo.readStream.close(); // 这可能不会关闭流。
    // 手动标记流的结束，就像底层的资源自身已表明文件的结束一样，使得流可以关闭。
    // 这不会取消待处理的读取操作，如果存在此类操作，则进程可能仍无法成功地退出，直到完成。
    // socket.readStream.push(null);
    socket.sendFileInfo.readStream.read(0);
  }
  socket.sendFileInfo = null;
}

function closeReceiveFile(socket) {
  if (!socket.recvFileInfo) {
    return;
  }
  fs.closeSync(socket.recvFileInfo.fd);
  socket.recvFileInfo = null;
}
