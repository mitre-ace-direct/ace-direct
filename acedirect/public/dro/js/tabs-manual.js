/*
 *   This content is licensed according to the W3C Software License at
 *   https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
 *
 *   File:   tabs-manual.js
 *
 *   Desc:   Tablist widget that implements ARIA Authoring Practices
 */

class TabsManual {
  constructor(groupNode) {
    this.tablistNode = groupNode;
    this.tabs = [];
    this.firstTab = null;
    this.lastTab = null;
    this.firstTabPanel = null;
    this.lastTabPanel = null;

    this.tabs = Array.from(this.tablistNode.querySelectorAll('[role=tab]'));
    this.tabpanels = [];
    this.selectedTab = null;
    this.selectedTabPanel = null;

    for (let i = 0; i < this.tabs.length; i += 1) {
      const tab = this.tabs[i];
      const tabpanel = document.getElementById(tab.getAttribute('aria-controls'));

      tab.tabIndex = -1;
      tab.setAttribute('aria-selected', 'false');
      this.tabpanels.push(tabpanel);

      tab.addEventListener('keydown', this.onKeydown.bind(this));
      tab.addEventListener('click', this.onClick.bind(this));

      if (!this.firstTab) {
        this.firstTab = tab;
        this.firstTabPanel = tabpanel;
      }
      this.lastTab = tab;
      this.lastTabPanel = tabpanel;
    }

    this.setSelectedTab(this.firstTab);
  }

  setSelectedTab(currentTab) {
    console.log(currentTab);

    // const $tabs = $('li.tab');
    for (let i = 0; i < this.tabs.length; i += 1) {
      if (currentTab === this.tabs[i]) {
        this.tabs[i].setAttribute('aria-selected', 'true');
        this.tabs[i].children[0].removeAttribute('tabindex');
        this.tabs[i].classList.add('active');
        this.tabpanels[i].classList.add('active');
      } else {
        this.tabs[i].setAttribute('aria-selected', 'false');
        this.tabs[i].children[0].tabIndex = -1;
        this.tabs[i].classList.remove('active');
        this.tabpanels[i].classList.remove('active');
      }

      // $($tabs.get(i)).parent().siblings().removeClass('active');
      // $($tabs.get(i)).parent().addClass('active');
    }
  }

  moveFocusToTab(currentTab, currentTabPanel) {
    currentTab.children[0].focus();
    this.selectedTab = currentTab;
    this.selectedTabPanel = currentTabPanel;
  }

  moveFocusToPreviousTab(currentTab) {
    let index;

    if (currentTab === this.firstTab) {
      this.moveFocusToTab(this.lastTab, this.lastTabPanel);
    } else {
      index = this.tabs.indexOf(currentTab);
      this.moveFocusToTab(this.tabs[index - 1], this.tabpanels[index - 1]);
    }
  }

  moveFocusToNextTab(currentTab) {
    let index;

    if (currentTab === this.lastTab) {
      this.moveFocusToTab(this.firstTab, this.firstTabPanel);
    } else {
      index = this.tabs.indexOf(currentTab);
      this.moveFocusToTab(this.tabs[index + 1], this.tabpanels[index + 1]);
    }
  }

  /* EVENT HANDLERS */
  onKeydown(event) {
    const tgt = event.currentTarget;
    let flag = false;

    switch (event.key) {
      case 'ArrowLeft':
        this.moveFocusToPreviousTab(tgt);
        flag = true;
        break;

      case 'ArrowUp':
        this.moveFocusToPreviousTab(tgt);
        flag = true;
        break;

      case 'ArrowRight':
        this.moveFocusToNextTab(tgt);
        flag = true;
        break;

      case 'ArrowDown':
        this.moveFocusToNextTab(tgt);
        flag = true;
        break;

      case 'Home':
        this.moveFocusToTab(this.firstTab);
        flag = true;
        break;

      case 'End':
        this.moveFocusToTab(this.lastTab);
        flag = true;
        break;

      case ' ':
        // open the tab with the spacebar
        this.selectedTab.click();
        this.selectedTabPanel.focus();
        break;

      case 'Enter':
        event.preventDefault();
        this.selectedTab.click();
        this.selectedTabPanel.focus();
        break;

      default:
        break;
    }

    if (flag) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  onClick(event) {
    this.setSelectedTab(event.currentTarget);
  }
}
