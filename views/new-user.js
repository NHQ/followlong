h1 NEW FEEDZ
p Welcome to #{title}
h2 #{body}
br
br
form(method: 'post', action: '/')
  div
    div
      span email :
      input(type: 'text', name: 'email', id: 'itemDate')
    div
      span password:
        input(type: 'text', name: 'password' id: 'editArticleBody')
    div
      input(type: 'hidden', name: 'hub.challenge', value: 'challenge')
    div#editArticleSubmit
      input(type: 'submit', value: 'Send')