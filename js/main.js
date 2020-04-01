/**
 * 
 */
 /* global m marked */
//this application only has one module: todo
var todo = {};

//for simplicity, we use this module to namespace the model classes

//the Todo class has two properties
todo.Todo = function(data) {
    this.description = m.prop(data.description);
    this.done = m.prop(false);
};

//the TodoList class is a list of Todo's
todo.TodoList = Array;

//the view-model tracks a running list of todos,
//stores a description for new todos before they are created
//and takes care of the logic surrounding when adding is permitted
//and clearing the input after adding a todo to the list
todo.vm = (function() {
    var vm = {}
    vm.init = function() {
        //a running list of todos
        vm.list = new todo.TodoList();

        //a slot to store the name of a new todo before it is created
        vm.description = m.prop("");

        //adds a todo to the list, and clears the description field for user convenience
        vm.add = function() {
            if (vm.description()) {
                vm.list.push(new todo.Todo({
                    description: vm.description()
                }));
                vm.description("");
            }
        };
    }
    return vm
}())

//the controller defines what part of the model is relevant for the current page
//in our case, there's only one view-model that handles everything
todo.controller = function() {
    todo.vm.init()
}
/*

<label class="example-send-yourself-copy">
    <input type="checkbox">
    <span class="label-body">Send a copy to yourself</span>
  </label>
  
  */
//here's the view
todo.view = function() {
    return m('div', [
        /*m("div.row", [
            m("div.columns.six", [
                m('label','Suggestions, questions?'),
                m("input[type=text][placeholder=Your email address].u-full-width", {
                    onchange: m.withAttr("value", todo.vm.description),
                    value: todo.vm.description()
                }),
                 //<textarea class="u-full-width" placeholder="Hi Dave …" id="exampleMessage"></textarea>
                m("textarea[placeholder=Your message].u-full-width")
            ]),
            
        ]),
         m("div.row", [
             m("div.columns.six", [
                m("button", {
                    onclick: todo.vm.add
                }, "Send"),
                m('label.send-yourself-copy', [ 
                    m('input[type=checkbox]'),
                    m('span.label-body', "Send a copy to yourself")
                ]),
            ]),
        ]),*/
        m("div.row", [
            m("table", [
                todo.vm.list.map(function(task, index) {
                    return m("tr", [
                        m("td", [
                            m("input[type=checkbox]", {
                                onclick: m.withAttr("checked", task.done),
                                checked: task.done()
                            })
                        ]),
                        m("td", {
                            style: {
                                textDecoration: task.done() ? "line-through" : "none"
                            }
                        }, task.description()),
                    ])
                })
            ])
        ])
    ])
};

var s = window.location.search,
    mdurl = s.substr(1) !== '' ?
    s.substr(s.length - 1) === '/' ?
    s.substr(1, s.length - 2) : s.substr(1, s.length - 1) : "md/index.md";

var md = m.request({
    method: "GET",
    url: mdurl,
    deserialize: function(value) {
        return value;
    }
});

md.then(function(data) {
        var mdcontent = document.getElementById('mdcontent');
        mdcontent.innerHTML = marked(data);
        document.body.style.display = 'block';
    },
    function() {
        var mdcontent = document.getElementById('mdcontent');
        mdcontent.innerHTML = marked("# 404\n Could not find `" + mdurl + "`");
        document.body.style.display = 'block';
    });

//initialize the application
m.mount(document.getElementById('todoapp'), {
    controller: todo.controller,
    view: todo.view
});
