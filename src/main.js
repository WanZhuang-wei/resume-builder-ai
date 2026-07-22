import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { Button, Form, Field, Cell, CellGroup, Tag, Tab, Tabs, Tabbar, TabbarItem, Grid, GridItem, Icon, Checkbox, CheckboxGroup, Loading, Dialog, Toast, Uploader, ActionSheet, Radio, RadioGroup, Sticky } from 'vant'
import 'vant/lib/index.css'

const app = createApp(App)
app.use(Button)
app.use(Form)
app.use(Field)
app.use(Cell)
app.use(CellGroup)
app.use(Tag)
app.use(Tab)
app.use(Tabs)
app.use(Tabbar)
app.use(TabbarItem)
app.use(Grid)
app.use(GridItem)
app.use(Icon)
app.use(Checkbox)
app.use(CheckboxGroup)
app.use(Loading)
app.use(Dialog)
app.use(Toast)
app.use(Uploader)
app.use(ActionSheet)
app.use(Radio)
app.use(RadioGroup)
app.use(Sticky)
app.use(createPinia())
app.use(router)
app.mount('#app')
