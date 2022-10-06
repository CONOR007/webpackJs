
module.exports = class Chunk {
    constructor(entryModule) {
        this.entryModule = entryModule;
        this.name = entryModule.name;
        this.files = []; // 记录每个cnhuk文件信息
        this.modules = []; // 记录每个chunk里所有的模块
    }
}