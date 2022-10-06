const path = require('path');
const types = require('@babel/types'); // 可以改语法树的节点
const generator = require('@babel/generator').default; // 它是esm所以用default导出来  ast不能运行,generator可以把ast运行起来
const traverse = require('@babel/traverse').default; // 它是esm所以用default导出来 traverse能帮助我们遍历ast树的每一个节点
module.exports = class NormalModule {
    constructor(data){
        this.context = data.context;
        this.name = data.name;
        this.moduleId = data.moduleId;
        this.entry = data.entry;
        this.rawRequest = data.rawRequest;
        this.parser = data.parser;  // TODO: 等待完成
        this.resource = data.resource;
        this._source // 存放某个模块的源代码
        this._ast // 存放某个模块的ast语法书
        this.dependencies = []; // 定义一个空数组用于保存被依赖加载的模块信息
    }
    build(compilation,callback){
        // 01 从文件中读取需要被加载到module内容
        // 02 如果当前不是js模块 则需要Loader进行处理,最终返回js模块
        // 03 上述操作完成之后就能将js代码转为ast语法树
        // 04 当前js模块内部可能又引用了其他模块,所以需要递归
        // 05 前面的完成之后 我们只需要重复执行即可
        this.doBuild(compilation,(err)=>{
            this._ast = this.parser.parse(this._source)
            // _ast就是当前module的语法书,我们可以对它进行修改最后再将ast转回code代码
            traverse(this._ast,{
                CallExpression: (nodePath)=>{
                    let node = nodePath.node
                    // 定位require所在的节点
                    if(node.callee.name === "require"){
                        // 获取原始请求路径
                        let modulePath = node.arguments[0].value; // './title'
                        // 取出当前被加载的模块名称
                        let moduleName = modulePath.split(path.posix.sep).pop();
                        // 当前我们的打包器之处理js
                        let extName = moduleName.indexOf(".") === -1 ? ".js" : ''
                        moduleName += extName // title.js
                        // 最终我们想要读区当前js里面的内容 所以我们需要绝对路径
                        let depResource = path.posix.join(path.posix.dirname(this.resource), moduleName)
                        // 将当前模块 id定义
                        let depModuleId = './' + path.posix.relative(this.context, depResource) // ./src/title.js
                        // 记录当前被依赖模块的信息 方便后面递归加载
                        this.dependencies.push({
                            name:this.name,// TODO:将来需要动态修改
                            context:this.context,
                            rawRequest:moduleName,
                            moduleId:depModuleId,
                            resource:depResource
                        })
                        // 替换内容
                        node.callee.name = "__webpack_require__"
                        node.arguments = [types.stringLiteral(depModuleId)]
                    }
                }
            })
            // 上述的操作是利用ast按要求做了代码修改 下面的内容就是利用generator 将修改后的ast转回城code
            let {code} = generator(this._ast)
            this._source = code
            callback(err)
        })
    }
    // 处理ast语法书
    doBuild(compilation,callback) {
        this.getSources(compilation,(err,sources)=>{
            this._source = sources;
            callback()
        })
    }
    // 拿源代码
    getSources(compilation,callback) {
        compilation.inputFileSystem.readFile(this.resource,'utf8',callback)
    }
};