import './styles.css';
import { createApp } from './app';
import { boot, watchBootErrors } from './boot';

watchBootErrors();
boot(createApp);
