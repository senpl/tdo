import {HtmlElement, TextField, TextArea, LookupField, Button, Select, Repeater} from 'cx/widgets';
import {LabelsTopLayout} from 'cx/ui';

export default (
  <cx>
    <div class="cxb-listeditor">
      <div layout={{ type: LabelsTopLayout, mod: "stretch" }}>
        <TextField
          value:bind="$list.name"
          label="Name"
          autoFocus
          style="width:100%;"
        />
      </div>

      <br />

      <div>
        <Button onClick="listMoveLeft">Move Left</Button>
        <Button onClick="listMoveRight" style="float:right">
          Move Right
        </Button>
      </div>

      <div layout={{ type: LabelsTopLayout, mod: "stretch" }}>
        <TextField
          value:bind="$list.headerClass"
          label="Header Class"
          placeholder="CSS class"
          style="width:100%;"
        />
      </div>

      <div layout={{ type: LabelsTopLayout, mod: "stretch" }}>
        <TextArea
          value:bind="$list.headerStyle"
          label="Header Style"
          placeholder="color"
          reactOn="input"
          style="width:100%;"
        />
      </div>

      <div layout={{ type: LabelsTopLayout, mod: "stretch" }}>
        <TextField
          value:bind="$list.className"
          label="List Class"
          placeholder="CSS class"
          style="width:100%;"
        />
      </div>

      <div layout={{ type: LabelsTopLayout, mod: "stretch" }}>
        <TextArea
          value:bind="$list.listStyle"
          label="List Style"
          placeholder="width, background"
          reactOn="input"
          style="width:100%;"
        />
      </div>

      <div layout={{ type: LabelsTopLayout, mod: "stretch" }}>
        <Select value:bind="$list.taskAddAsFirst" label="New task order">
          <option value="false" text="New task on list last element" />
          <option value="true" text="New task on list first element" />
        </Select>
      </div>
      <br />

      <div>
        <Button onClick="onSaveList">Save</Button>
        <Button
          mod="danger"
          confirm="Are you sure?"
          onClick="deleteList"
          style="float:right"
        >
          Delete
        </Button>
      </div>
      <br />
    </div>
  </cx>
);
