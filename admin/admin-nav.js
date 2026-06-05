(function () {
  var PIPELINE = [
    { label: 'Idea Review', href: '/admin/idea-review/' },
    { label: 'Media Queue', href: '/admin/va-queue/' },
    { label: 'Analytics',   href: '/admin/blog-dashboard/' },
  ]

  var path = location.pathname.replace(/\/$/, '') || '/admin'

  // Carry ?secret=… across admin nav links so a VA on a URL-secret session
  // never hits the login page when clicking between Idea Review / Media Queue.
  var secret = new URLSearchParams(location.search).get('secret') || ''
  function withAuth(href) {
    if (!secret) return href
    return href + (href.indexOf('?') === -1 ? '?' : '&') + 'secret=' + encodeURIComponent(secret)
  }

  function isActive(href) {
    var h = href.replace(/\/$/, '')
    if (path.indexOf('/admin/va-queue') === 0 && h === '/admin/va-queue') return true
    if (path.indexOf('/admin/idea-review') === 0 && h === '/admin/idea-review') return true
    if (path.indexOf('/admin/blog-dashboard') === 0 && h === '/admin/blog-dashboard') return true
    return path === h || path === h + '/index.html'
  }

  var style = document.createElement('style')
  style.textContent = [
    '.sg-admin-nav{position:sticky;top:0;z-index:9999;background:#111827;display:flex;align-items:center;padding:0 20px;height:52px;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;border-bottom:1px solid rgba(255,255,255,0.06);}',
    '.sg-admin-nav::-webkit-scrollbar{display:none;}',
    '.sg-admin-nav .sg-brand{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.3);padding-right:18px;border-right:1px solid rgba(255,255,255,0.1);margin-right:12px;white-space:nowrap;flex-shrink:0;text-decoration:none;}',
    '.sg-admin-nav .sg-section{font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-right:6px;flex-shrink:0;}',
    '.sg-admin-nav .sg-divider{width:1px;height:22px;background:rgba(255,255,255,0.1);margin:0 12px;flex-shrink:0;}',
    '.sg-admin-nav a.sg-link{padding:0 13px;line-height:52px;font-size:13px;font-weight:400;color:rgba(255,255,255,0.5);text-decoration:none;background:transparent;border-radius:6px;white-space:nowrap;flex-shrink:0;transition:color .15s,background .15s;}',
    '.sg-admin-nav a.sg-link:hover{color:rgba(255,255,255,0.85);}',
    '.sg-admin-nav a.sg-link.active{color:#fff;font-weight:600;background:rgba(255,255,255,0.09);}',
    '.sg-admin-nav .sg-spacer{flex:1;}',
    '.sg-admin-nav .sg-live{padding:5px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#064e3b;color:#6ee7b7;white-space:nowrap;flex-shrink:0;}',
  ].join('')
  document.head.appendChild(style)

  var nav = document.createElement('nav')
  nav.className = 'sg-admin-nav'

  var brand = document.createElement('a')
  brand.className = 'sg-brand'
  brand.href = withAuth('/admin/')
  brand.textContent = 'Shana Gates'
  nav.appendChild(brand)

  var pipelineLabel = document.createElement('span')
  pipelineLabel.className = 'sg-section'
  pipelineLabel.textContent = 'Pipeline'
  nav.appendChild(pipelineLabel)

  PIPELINE.forEach(function (item) {
    var a = document.createElement('a')
    a.className = 'sg-link' + (isActive(item.href) ? ' active' : '')
    a.href = withAuth(item.href)
    a.textContent = item.label
    nav.appendChild(a)
  })

  var spacer = document.createElement('div')
  spacer.className = 'sg-spacer'
  nav.appendChild(spacer)

  var live = document.createElement('div')
  live.className = 'sg-live'
  live.textContent = '● Live'
  nav.appendChild(live)

  var header = document.querySelector('header')
  if (header) {
    document.body.insertBefore(nav, header)
  } else {
    document.body.insertBefore(nav, document.body.firstChild)
  }
})()
