import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { AzureDevopsClient, AzureDevopsSettings, AZURE_DEVOPS_DEFAULT_SETTINGS } from 'src/Clients/AzureDevopsClient'
import { ITfsClient } from './src/Clients/ITfsClient';
import { JiraClient, JiraSettings, JIRA_DEFAULT_SETTINGS } from './src/Clients/JiraClient';

export interface AgileTaskNotesSettings {
  selectedTfsClient: string,
  targetFolder: string,
  noteTemplate: string,
	azureDevopsSettings: AzureDevopsSettings,
  jiraSettings: JiraSettings
}

const DEFAULT_SETTINGS: AgileTaskNotesSettings = {
  selectedTfsClient: 'AzureDevops',
  targetFolder: '',
  noteTemplate: '# {{TASK_TITLE}}\n#{{TASK_TYPE}}\n\nLink: {{TASK_LINK}}\n\n#todo:\n- [ ] Create todo list\n- [ ] \n\n## Notes:\n',
  azureDevopsSettings: AZURE_DEVOPS_DEFAULT_SETTINGS,
  jiraSettings: JIRA_DEFAULT_SETTINGS
}

export default class AgileTaskNotesPlugin extends Plugin {
	settings: AgileTaskNotesSettings;

  tfsClientImplementations: { [key: string]: ITfsClient } = {};

	async onload() {

    // Add TFS backend implmentations
    var azureDevopsClient:ITfsClient = new AzureDevopsClient();
    var jiraClient: ITfsClient = new JiraClient();
    
    this.tfsClientImplementations[azureDevopsClient.clientName] = azureDevopsClient;
    this.tfsClientImplementations[jiraClient.clientName] = jiraClient;

    await this.loadSettings();

		// This creates an icon in the left ribbon for updating boards.
		this.addRibbonIcon('dice', 'Update Current Sprint', () => {
			this.tfsClientImplementations[this.settings.selectedTfsClient].updateCurrentSprint(this.settings);
      new Notice('Updated current sprint successfully!');
		});

		this.addCommand({
			id: 'aupdate-current-sprint',
			name: 'Update Current Sprint',
			callback: () => {
				this.tfsClientImplementations[this.settings.selectedTfsClient].updateCurrentSprint(this.settings);
        new Notice('Updated current sprint successfully!');
			}
		});

		this.addSettingTab(new AgileTaskNotesPluginSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class AgileTaskNotesPluginSettingTab extends PluginSettingTab {
	plugin: AgileTaskNotesPlugin;

	constructor(app: App, plugin: AgileTaskNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl, plugin} = this;

		containerEl.empty();

    new Setting(containerEl)
      .setName('Backend TFS')
      .setDesc('The type of TFS you use.')
      .addDropdown((dropdown) => {
        for (const client in plugin.tfsClientImplementations) {
          dropdown.addOption(client, client);
        }
        dropdown.setValue(plugin.settings.selectedTfsClient)
          .onChange(async (value) => {
            plugin.settings.selectedTfsClient = value;
            await plugin.saveSettings();
            this.display();
          });
      });

    plugin.tfsClientImplementations[plugin.settings.selectedTfsClient].setupSettings(containerEl, plugin);

    containerEl.createEl('h2', {text: 'Vault Settings'});

    new Setting(containerEl)
    .setName('Target Folder (Optional)')
    .setDesc('The relative path to the parent folder in which to create/update Kanban boards')
    .addText(text => text
      .setPlaceholder('Enter target folder')
      .setValue(plugin.settings.targetFolder)
      .onChange(async (value) => {
        plugin.settings.targetFolder = value;
        await plugin.saveSettings();
      }));

    new Setting(containerEl)
    .setName('Inital Task Content')
    .setDesc('Set the inital content for each new task note. Available variables: {{TASK_TITLE}}, {{TASK_TYPE}}, {{TASK_LINK}}')
    .addTextArea(text => {
        text
            .setPlaceholder('Initial content in raw markdown format')
            .setValue(this.plugin.settings.noteTemplate)
            .onChange(async (value) => {
                try {
                    this.plugin.settings.noteTemplate = value;
                    await this.plugin.saveSettings();
                } catch (e) {
                    return false;
                }
            })
        text.inputEl.rows = 8;
        text.inputEl.cols = 50;
    });
	}
}
