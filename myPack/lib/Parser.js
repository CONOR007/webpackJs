const {
    Tapable,
    AsyncSeriesHook,
    SyncBailHook,
    SyncHook,
    AsyncParallelHook
} = require('tapable');
const babylon = require('babylon');
module.exports = class Parser extends Tapable {
    parse(sources) {
        return babylon.parse(sources,{
            sourceType:'module',
            plugins:['dynamicImport']
        })
    }
}