const {
  Tapable,
  AsyncSeriesHook,
  SyncBailHook,
  SyncHook,
  AsyncParallelHook,
} = require("tapable");
const Parser = require("./Parser");
const Chunk = require("./Chunk");
const parser = new Parser();
const NormalModuleFactory = require("./NormalModuleFactory");
const path = require("path");
const ejs = require("ejs");
const async = require("neo-async");
module.exports = class Compilation extends Tapable {
  constructor(compiler) {
    super();
    this.compiler = compiler;
    this.context = compiler.context;
    this.option = compiler.option;
    // 让compilation具备文件读写能力
    this.inputFileSystem = compiler.inputFileSystem;
    this.outputFileSystem = compiler.outputFileSystem;
    this.entries = []; // 存放所有入口模块的数组
    this.modules = []; // 存放所有模块的数组
    this.hooks = {
      succeedModule: new SyncHook(["module"]),
      seal: new SyncHook(),
      beforeChunks: new SyncHook(),
      afterChunks: new SyncHook(),
    };
    this.chunks = []; // 存放当前打包过程中所产出的chunk
    this.assets = {};
    this.files = [];
  }
  // 模块的编译
  addEntry(context, entry, name, callback) {
    this._addModuleChain(context, entry, name, (err, module) => {
      callback(err, module);
    });
  }
  _addModuleChain(context, entry, name, callback) {
    this.createModule(
      {
        name,
        context,
        rawRequest: entry,
        resource: path.posix.join(context, entry),
        parser,
        moduleId:
          "./" + path.posix.relative(context, path.posix.join(context, entry)),
      },
      (entryModule) => {
        this.entries.push(entryModule);
      },
      callback
    );
  }
  createModule(data, doAddEntry, callback) {
    let module = new NormalModuleFactory().create(data);
    const afterBuild = (err, module) => {
      // 在afterBuild中需要判断当前module加载完成之后 是否需要处理依赖加载 从而递归
      if (module.dependencies.length > 0) {
        // 当前逻辑表示module有需要依赖加载的模块 因此单独定义一个方法实现
        this.processDependencies(module, (err) => {
          callback(err, module);
        });
      } else {
        callback(err, module);
      }
    };
    this.buildModule(module, afterBuild);
    // 当完成本次的build操作之后 将module保存
    doAddEntry && doAddEntry(module);
    this.modules.push(module);
  }
  buildModule(module, callback) {
    module.build(this, (err) => {
      // 如果代码走到这意味着当前module完成
      this.hooks.succeedModule.call(module);
      callback(err, module);
    });
  }
  processDependencies(module, callback) {
    // 01 当前的函数核心功能是实现一个被依赖模块的递归加载
    // 02 加载模块的思路都是创建一个模块,然后想办法将被加载模块内容拿进来
    // 03 当前我们不知道module需要依赖几个模块 此时我们需要想办法让所有的被依赖的模块都加载完成之后再执行 callback
    let dependencies = module.dependencies;
    async.forEach(
      dependencies,
      (dependency, done) => {
        this.createModule(
          {
            parser,
            name: dependency.name,
            context: dependency.context,
            rawRequest: dependency.rawRequest,
            moduleId: dependency.moduleId,
            resource: dependency.resource,
          },
          null,
          done
        );
      },
      callback
    );
  }
  // 封装thunk
  seal(callback) {
    this.hooks.seal.call();
    this.hooks.beforeChunks.call();
    // 01 当前所有的入口模块都被存放在compilation的entries数组里
    // 02 所谓封装chunk就是依据某个入口找到所有的依赖,将他们的源码放在一起,之后再合并
    for (const entryModule of this.entries) {
      // 核心: 创建模块加载已有模块的内容 同时记录模块信息
      const chunk = new Chunk(entryModule);
      // 保存chunk信息
      this.chunks.push(chunk);
      // 给chunk属性赋值
      chunk.modules = this.modules.filter(
        (module) => module.name === chunk.name
      );
    }
    // chunk流程梳理完成之后 就进入到chunk代码处理环节(模版文件+模块中的源代码 =》 chunk.js)
    this.hooks.afterChunks.call(this.chunk);
    // 生产代码内容
    this.createChunkAssets();
    callback();
  }
  // 根据chunk信息和当前模版把内容组合起来
  createChunkAssets() {
    for (let index = 0; index < this.chunks.length; index++) {
      const chunk = this.chunks[index];
      const fileName = chunk.name + ".js";
      chunk.files.push(fileName);
      // 生产具体的chunk内容
      // 01 获取模版文件的路径
      let tempPath = path.join(__dirname, "temp/main.ejs");
      // 02 读取模块文件中的内容
      let tempCode = this.inputFileSystem.readFileSync(tempPath, "utf8");
      // 03 获取渲染函数
      let tempRender = ejs.compile(tempCode);
      // 04 按照ejs模版提供数据
      let source = tempRender({
        entryModuleId: chunk.entryModule.moduleId,
        modules: chunk.modules,
      });
      // 输出文件
      this.emitAssets(fileName, source);
    }
  }
  emitAssets(fileName, source) {
    this.assets[fileName] = source;
    this.files.push(fileName);
  }
};
