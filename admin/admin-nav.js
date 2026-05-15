(function () {
  var LINKS = [
    { section: 'PIPELINE' },
    { label: 'Blog Picker',    href: '/admin/blog-picker/' },
    { label: 'Weekly Picker',  href: '/admin/weekly-picker/' },
    { label: 'Idea Review',    href: '/admin/idea-review/' },
    { label: 'Strategic',      href: '/admin/strategic-picker/' },
    { divider: true },
    { section: 'CONTENT' },
    { label: 'VA Queue',       href: '/admin/va-queue/' },
    { label: 'Blog Editor',    href: '/admin/blog-editor/' },
    { label: 'Create Post',    href: '/admin/blog-create/' },
    { label: 'Events',         href: '/admin/event-publisher/' },
    { divider: true },
    { section: 'ANALYTICS' },
    { label: 'Dashboard',      href: '/admin/blog-dashboard/' },
    { divider: true },
    { section: 'TOOLS' },
    { label: 'AI Assistant',   href: '/admin/assistant/' },
    { label: 'Brand Guide',    href: '/brand-guide/' },
  ]

  var path = location.pathname.replace(/\/$/, '') || '/admin'

  function isActive(href) {
    var h = href.replace(/\/$/, '')
    // va-queue editor counts as va-queue active
    if (path.indexOf('/admin/va-queue') === 0 && h === '/admin/va-queue') return true
    return path === h || path === h + '/index.html'
  }

  var style = document.createElement('style')
  style.textContent = [
    '.sg-admin-nav{position:sticky;top:0;z-index:9999;background:#0d0d0d;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;padding:0 20px;height:40px;gap:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}',
    '.sg-admin-nav::-webkit-scrollbar{display:none;}',
    '.sg-admin-nav a.sg-nav-home{color:#B8975A;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700;text-decoration:none;white-space:nowrap;padding-right:16px;flex-shrink:0;}',
    '.sg-nav-divider{width:1px;height:18px;background:rgba(255,255,255,0.1);margin:0 12px;flex-shrink:0;}',
    '.sg-nav-section{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.28);font-weight:600;padding:0 6px 0 2px;white-space:nowrap;flex-shrink:0;}',
    '.sg-admin-nav a.sg-nav-link{font-size:12px;color:rgba(255,255,255,0.52);text-decoration:none;padding:0 10px;height:40px;display:flex;align-items:center;white-space:nowrap;border-radius:0;transition:color .15s;flex-shrink:0;position:relative;}',
    '.sg-admin-nav a.sg-nav-link:hover{color:rgba(255,255,255,0.85);}',
    '.sg-admin-nav a.sg-nav-link.active{color:#fff;font-weight:600;background:rgba(255,255,255,0.07);border-radius:6px;}',
  ].join('')
  document.head.appendChild(style)

  var nav = document.createElement('nav')
  nav.className = 'sg-admin-nav'

  // Brand home link
  var home = document.createElement('a')
  home.className = 'sg-nav-home'
  home.href = '/admin/'
  home.textContent = 'SHANA GATES'
  nav.appendChild(home)

  LINKS.forEach(function (item) {
    if (item.divider) {
      var d = document.createElement('span')
      d.className = 'sg-nav-divider'
      nav.appendChild(d)
    } else if (item.section) {
      var s = document.createElement('span')
      s.className = 'sg-nav-section'
      s.textContent = item.section
      nav.appendChild(s)
    } else {
      var a = document.createElement('a')
      a.className = 'sg-nav-link' + (isActive(item.href) ? ' active' : '')
      a.href = item.href
      a.textContent = item.label
      nav.appendChild(a)
    }
  })

  // Insert before <header> if present, otherwise prepend to body
  var header = document.querySelector('header')
  if (header) {
    document.body.insertBefore(nav, header)
  } else {
    document.body.insertBefore(nav, document.body.firstChild)
  }
})()
