/*
相当于Vue的构造函数
 */
function MVVM(options) {
  //把配置赋值到vm上
  this.$options = options;
  //将配置中的data数据复制给vm的data和变量data
  var data = this._data = this.$options.data;
  //将vm赋值给me，防止后面的this指向改变
  var me = this;
  
  //遍历data中的属性名进行数据代理
  Object.keys(data).forEach(function (key) {// 属性名: name
    me._proxy(key);
  });

  observe(data, this);
  
  //在内存中创建一个空容器
  this.$compile = new Compile(options.el || document.body, this)
}

MVVM.prototype = {
  $watch: function (key, cb, options) {
    new Watcher(this, key, cb);
  },

  
  _proxy: function (key) {
    //将vm给me
    var me = this;
    //用属性描述符的方式给对象中每个属性名进行代理
    Object.defineProperty(me, key, {
      configurable: false, // 不能重新再定义
      enumerable: true, // 可以枚举
      //当通过vue.xxx得到属性名的值的时候调用，其实值是从vm.data.name取出
      get: function proxyGetter() {
        return me._data[key];
      },
      //当属性值发生了改变时调用，将新的属性名添加到vm.data这个对象上
      set: function proxySetter(newVal) {
        me._data[key] = newVal;
      }
    });
  }
};