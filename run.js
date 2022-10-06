let webpack = require('./myPack/lib/webpack')
let options = require('./webpack.config')
let compiler = webpack(options)

compiler.run((err, stats) => {
  console.log(stats)
})