function Compile(el, vm) {
  //将vm进行赋值
  this.$vm = vm;
  //判断el是否是元素节点，保存el元素
  this.$el = this.isElementNode(el) ? el : document.querySelector(el);
  //el存在
  if (this.$el) {
    //1.取出所有子节点并保存到fragment中   这里2是to的意思
    this.$fragment = this.node2Fragment(this.$el);
    //2.初始化编译，对fragment中所有的子节点进行遍历
    this.init();
    //3.将编译好的fragment中的元素添加到el中，格式不会改变的
    this.$el.appendChild(this.$fragment);
  }
}

Compile.prototype = {
  node2Fragment: function (el) {
    // 创建内存中的fragment容器
    var fragment = document.createDocumentFragment(),
      child;
    
    //遍历el中的所有子节点，转移到fragment容器中
    while (child = el.firstChild) {
      fragment.appendChild(child);
    }
    //返回fragment
    return fragment;
  },

  init: function () {
    //编译fragment中的所有子节点
    this.compileElement(this.$fragment);
  },


  compileElement: function (el) {
    //el中的所有子节点
    var childNodes = el.childNodes,
      //vm
      me = this;
    //遍历所有子节点
    [].slice.call(childNodes).forEach(function (node) {
      //子节点中的文本内容
      var text = node.textContent;
      //判断正则匹配双大括号表达式     ()这里面还可以匹配到表达式name
      var reg = /\{\{(.+)\}\}/;  // {{name}}

      //如果是元素节点
      if (me.isElementNode(node)) {
        //编译标签中的指令属性
        me.compile(node);
      //如果是文本节点
      } else if (me.isTextNode(node) && reg.test(text)) {
        //编译大括号表达式的文本节点
        me.compileText(node, RegExp.$1); //  $1匹配到的 表达式: name
      }

      //如果当前节点还有子节点的话，调用递归来遍历到每一个子节点
      if (node.childNodes && node.childNodes.length) {
        me.compileElement(node);
      }
    });
  },

  compile: function (node) {
    //得到所有属性节点
    var nodeAttrs = node.attributes,
      //保存编译对象
      me = this;
    //编译所有属性节点
    [].slice.call(nodeAttrs).forEach(function (attr) {
      //得到属性名 v-on:click
      var attrName = attr.name;
      //如果指令属性
      if (me.isDirective(attrName)) {
        //得到属性值（表达式）： show
        var exp = attr.value;
        //得到指令名 (on:click)
        var dir = attrName.substring(2);
        // 事件指令
        if (me.isEventDirective(dir)) {
          compileUtil.eventHandler(node, me.$vm, exp, dir);
          // 普通指令
        } else {
          //得到指令对应的变异工具进行执行编译：/text/html/class
          compileUtil[dir] && compileUtil[dir](node, me.$vm, exp);
        }
        //移除指令属性
        node.removeAttribute(attrName);
      }
    });
  },

  //编译文本节点
  compileText: function (node, exp) { // node = text  exp: 表达式(name)
    // 调用编译工具的.text()方法来进行编译文本节点
    compileUtil.text(node, this.$vm, exp);
  },

  isDirective: function (attr) {
    return attr.indexOf('v-') == 0;
  },

  isEventDirective: function (dir) {
    return dir.indexOf('on') === 0;
  },

  isElementNode: function (node) {
    return node.nodeType == 1;
  },

  isTextNode: function (node) {
    return node.nodeType == 3;
  }
};

// 用于解析指令/大括号表达式的工具对象
var compileUtil = {
  //编译v-text/大括号表达式的工具函数，具体调用bind方法来实现
  text: function (node, vm, exp) {
    this.bind(node, vm, exp, 'text');
  },

  //编译v-html的工具函数
  html: function (node, vm, exp) {
    this.bind(node, vm, exp, 'html');
  },
  //编译v-model的工具函数
  model: function (node, vm, exp) {
    this.bind(node, vm, exp, 'model');
    //将vm给me
    var me = this,
      //得到指定表达式的值
      val = this._getVMVal(vm, exp);
    node.addEventListener('input', function (e) {
      var newValue = e.target.value;
      if (val === newValue) {
        return;
      }

      me._setVMVal(vm, exp, newValue);
      val = newValue;
    });
  },

  // 编译v-class的工具函数
  class: function (node, vm, exp) {
    this.bind(node, vm, exp, 'class');
  },

/*
* 真正编译指令的工具函数
* node:节点
* vm：mvvm的实例
* exp：表达式
* dir：指令
* */
  bind: function (node, vm, exp, dir) {
    
    //根据指令名来得到对应的节点更新的函数
    var updaterFn = updater[dir + 'Updater'];

    //执行更新函数更新节点，实现初始化显示
    updaterFn && updaterFn(node, this._getVMVal(vm, exp));

    new Watcher(vm, exp, function (value, oldValue) {
      updaterFn && updaterFn(node, value, oldValue);
    });
  },

  // 事件处理
  //exp:表达式  (show)
  //dir:指令名  (on:click)   v-后面的
  eventHandler: function (node, vm, exp, dir) {
    //得到事件名/类型： click
    var eventType = dir.split(':')[1],
      //根据表达式从methods配置中取出对应的函数
      fn = vm.$options.methods && vm.$options.methods[exp];
    //如果都存在
    if (eventType && fn) {
      //给文本节点绑定对应类型的监听，回调函数，强制绑定this为vm的 dom事件监听
      node.addEventListener(eventType, fn.bind(vm), false);
    }
  },

  //得到指定表达式所对应的值，例如 a.b
  _getVMVal: function (vm, exp) {
    var val = vm._data;
    exp = exp.split('.');
    exp.forEach(function (k) {
      val = val[k];
    });
    return val;
  },

  
  _setVMVal: function (vm, exp, value) {
    var val = vm._data;
    exp = exp.split('.');
    exp.forEach(function (k, i) {
      // 非最后一个key，更新val的值
      if (i < exp.length - 1) {
        val = val[k];
      } else {
        val[k] = value;
      }
    });
  }
};

// 包含了n个方法的更新函数
var updater = {
  // 更新节点的textContent属性
  textUpdater: function (node, value) {
    node.textContent = typeof value == 'undefined' ? '' : value;
  },

  // 更新节点的innerHTML属性
  htmlUpdater: function (node, value) {
    node.innerHTML = typeof value == 'undefined' ? '' : value;
  },

  // 更新节点的className属性
  classUpdater: function (node, value, oldValue) {
    var className = node.className;
    className = className.replace(oldValue, '').replace(/\s$/, '');

    var space = className && String(value) ? ' ' : '';

    node.className = className + space + value;
  },

  // 更新节点的value属性
  modelUpdater: function (node, value, oldValue) {
    node.value = typeof value == 'undefined' ? '' : value;
  }
};