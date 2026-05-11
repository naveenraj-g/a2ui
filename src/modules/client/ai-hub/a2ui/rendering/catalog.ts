import { Text } from "../catalog/text";
import { Row } from "../catalog/row";
import { Column } from "../catalog/column";
import { Image } from "../catalog/image";
import { Icon } from "../catalog/icon";
import { Button } from "../catalog/button";
import { Card } from "../catalog/card";
import { Tabs } from "../catalog/tabs";
import { Modal } from "../catalog/modal";
import { Checkbox } from "../catalog/checkbox";
import { TextField } from "../catalog/text-field";
import { DateTimeInput } from "../catalog/datetime-input";
import { Slider } from "../catalog/slider";
import { MultipleChoice } from "../catalog/multiple-choice";
import { List } from "../catalog/list";
import { Divider } from "../catalog/divider";
import { Video } from "../catalog/video";
import { AudioPlayer } from "../catalog/audio-player";
import { Table } from "../catalog/table";
// import Chart from "../catalog/chart";
import { Form } from "../catalog/form";
import { Switch } from "../catalog/switch";
import { RadioGroup } from "../catalog/radio-group";
import { Badge } from "../catalog/badge";
import { Avatar } from "../catalog/avatar";
import { Alert } from "../catalog/alert";
import { Progress } from "../catalog/progress";
import { Spinner } from "../catalog/spinner";
import { Accordion } from "../catalog/accordion";
import { Breadcrumb } from "../catalog/breadcrumb";
import { SearchField } from "../catalog/search-field";
import { Link } from "../catalog/link";
import { Separator } from "../catalog/separator";
import { Markdown } from "../catalog/markdown";

export type ComponentConfig = {
  component: React.ComponentType<any>;
};

export type Catalog = {
  [key: string]: ComponentConfig;
};

export const DEFAULT_CATALOG: Catalog = {
  Text: { component: Text },
  Row: { component: Row },
  Column: { component: Column },
  Image: { component: Image },
  Icon: { component: Icon },
  Button: { component: Button },
  Card: { component: Card },
  Tabs: { component: Tabs },
  Modal: { component: Modal },
  CheckBox: { component: Checkbox },
  TextField: { component: TextField },
  DateTimeInput: { component: DateTimeInput },
  Slider: { component: Slider },
  MultipleChoice: { component: MultipleChoice },
  List: { component: List },
  Divider: { component: Divider },
  Video: { component: Video },
  AudioPlayer: { component: AudioPlayer },
  Table: { component: Table },
  // Chart: { component: Chart },
  Form: { component: Form },
  Switch: { component: Switch },
  RadioGroup: { component: RadioGroup },
  Badge: { component: Badge },
  Avatar: { component: Avatar },
  Alert: { component: Alert },
  Progress: { component: Progress },
  Spinner: { component: Spinner },
  Accordion: { component: Accordion },
  Breadcrumb: { component: Breadcrumb },
  SearchField: { component: SearchField },
  Link: { component: Link },
  Separator: { component: Separator },
  Markdown: { component: Markdown },
};
