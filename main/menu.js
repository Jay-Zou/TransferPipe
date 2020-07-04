const { Menu, BrowserWindow } = require('electron')
var template = [
    {
        label: '文件',
        submenu: [
            {
                label: '创建文件',
                // 绑定点击事件
                click: () => {
                    // 打开新窗口
                    subWindow = new BrowserWindow({
                        width: 500,
                        height: 500,
                        webPreferences: {
                            nodeIntegration: true
                        }
                    })
                    subWindow.loadFile('yellow.html')
                    subWindow.on('closed', () => {
                        subWindow = null
                    })
                }
            },
            { label: '打开文件' }
        ]
    },
    {
        label: '编辑',
        submenu: [
            { label: '撤销' },
            { label: '反撤销' }
        ]
    },
    {
        label: '视图',
        submenu: [
            { label: '全屏' },
            { label: '最大化' }
        ]
    }
]
// 使用模板 build 出菜单
var m = Menu.buildFromTemplate(template)
// 设置为 app 的菜单
Menu.setApplicationMenu(m)