const Compiler = require('./Compiler');
const NodeEnvironmentPlugin = require('./node/NodeEnvironmentPlugin');
const WebpackOptionsApply = require('./WebpackOptionsApply');

const webpack = function (options) {
    // 01 实力化 compiler 对象
    let compiler = new Compiler(options);
    compiler.options = options;
    // 02 初始化 NodeEnvironmentPlugin(让compiler具备文件读写能力)
    new NodeEnvironmentPlugin(options).apply(compiler);
    // 03 挂载所有plugins插件至compiler对象上
    if (options.plugins && Array.isArray(options.plugins)) {
        for (const plugin of options.plugins) {
            plugin.apply(compiler)
        }
    }
    // 04 挂载所有webpack内置的插件(入口)
    new WebpackOptionsApply().process(options, compiler);
    // 05 返回compiler对象
    return compiler;
}
module.exports = webpack;